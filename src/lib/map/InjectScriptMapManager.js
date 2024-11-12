/* global lighthouseEnviroment, lighthouseUrl, urls, user */
const $ = require('jquery');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DOM = require('jsx-dom-factory').default;
const moment = require('moment');
const LighthouseMap = require('./LighthouseMap.js').default;
const MapLayer = require('./MapLayer.js').default;

/**
 * Sends the selected HQs & start/end date range to the content script.
 *
 * @param filterViewModel the filter view model.
 */
function sendStateToContentScript(filterViewModel, firstRun = false) {
  let startMoment = filterViewModel.startDate();
  let endMoment = filterViewModel.endDate();
  let startDate = startMoment ? startMoment.toDate() : null;
  let endDate = endMoment ? endMoment.toDate() : null;

  let params = {
    hqs: filterViewModel.selectedEntities.peek(),
    startDate: startDate,
    endDate: endDate,
    firstRun: firstRun,
  };
  window.postMessage({ type: 'LH_SELECTED_STATE', params: params }, '*');
}

window.addEventListener('message', function (event) {
  // We only accept messages from content scrip
  if (event.source !== window) return;

  const lighthouseMap = window['lighthouseMap'];

  if (event.data.type) {
    if (event.data.type === 'LH_REQUEST_HELI_PARAMS') {
      let params = buildHeliParams();
      window.postMessage(
        { type: 'LH_RESPONSE_HELI_PARAMS', params: params },
        '*',
      );
    } else if (event.data.type === 'LH_UPDATE_LAYERS_DATA') {
      let mapLayerName = event.data.layer;
      let mapLayer = lighthouseMap.layers()[mapLayerName];
      mapLayer.clear();

      if (event.data.layer === 'rfs') {
        showRuralFires(mapLayer, event.data.response);
      } else if (event.data.layer === 'transport-incidents') {
        showTransportIncidents(mapLayer, event.data.response);
      } else if (event.data.layer === 'transport-flood-reports') {
        showTransportFlooding(mapLayer, event.data.response);
      } else if (event.data.layer === 'transport-cameras') {
        showTransportCameras(mapLayer, event.data.response);
      } else if (event.data.layer === 'helicopters') {
        showRescueHelicopters(mapLayer, event.data.response);
      } else if (event.data.layer === 'ses-teams') {
        showSesTeamsLocations(mapLayer, event.data.response);
      } else if (event.data.layer === 'ses-assets-filtered') {
        showSesFilteredAssets(mapLayer, event.data.response);
      } else if (event.data.layer === 'lhqs') {
        showLhqs(mapLayer, event.data.response);
      } else if (event.data.layer === 'srbs') {
        showSrbs(mapLayer, event.data.response);  
      } else if (event.data.layer === 'power-outages') {
        showPowerOutages(mapLayer, event.data.response);
      } else if (event.data.layer === 'hazard-watch') {
        showHazardWatch(mapLayer, event.data.response);
      }
    } else if (event.data.type === 'LH_CLEAR_LAYER_DATA') {
      console.info('clearing layer:' + event.data.layer);
      lighthouseMap.layers()[event.data.layer].clear();
    } else if (event.data.type === 'LH_GET_TRANSPORT_KEY') {
      var transportApiKeyOpsLog = '';
      switch (location.origin) {
        case 'https://previewbeacon.ses.nsw.gov.au':
          transportApiKeyOpsLog = '46273';
          break;
        case 'https://beacon.ses.nsw.gov.au':
          transportApiKeyOpsLog = '515514';
          break;
        case 'https://trainbeacon.ses.nsw.gov.au':
          transportApiKeyOpsLog = '36753';
          break;
        default:
          transportApiKeyOpsLog = '0';
      }

      let layer = event.data.layer;

      // Fetch the API key from an ops log and pass it back
      getOpsLog(transportApiKeyOpsLog, function (response) {
        let content = JSON.parse(response.responseText);
        let key = content.Text;
        window.postMessage(
          { type: 'LH_RESPONSE_TRANSPORT_KEY', key: key, layer: layer },
          '*',
        );
      });
    }
  }
});

/**
 * Gets an ops log from beacon.
 *
 * @param id the ID of the ops log.
 * @param cb the callback to send the response to.
 */
function getOpsLog(id, cb) {
  var urls = window.urls;
  var user = window.user;

  $.ajax({
    type: 'GET',
    url: urls.Base + '/Api/v1/OperationsLog/' + id,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: true,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus === 'success') {
        cb(response);
      } else {
        console.log('ajax text problem');
        cb(false);
      }
    },
    error: function (_ajaxContext) {
      console.log('ajax http problem');
      cb(false);
    },
  });
}

const developmentMode = lighthouseEnviroment === 'Development';
const lighthouseIcon = lighthouseUrl + 'icons/lh-black.png';
const powerIcon = lighthouseUrl + 'icons/power.png';
const helicopterLastKnownIcon =
  lighthouseUrl + 'icons/helicopter-last-known.png';
const teamEnrouteIcon = lighthouseUrl + 'icons/enroute.png';
const teamOnsiteIcon = lighthouseUrl + 'icons/bus.png';
const teamOffsiteIcon = lighthouseUrl + 'icons/offsite.png';

const assetIcon = lighthouseUrl + 'icons/asset-icons/asset';
const assetOrangeIcon = lighthouseUrl + 'icons/asset-icons/asset-orange';
const assetRedIcon = lighthouseUrl + 'icons/asset-icons/asset-red';
const assetBlueIcon = lighthouseUrl + 'icons/asset-icons/asset-blue';
const assetYellowIcon = lighthouseUrl + 'icons/asset-icons/asset-yellow';
const assetBrownIcon = lighthouseUrl + 'icons/asset-icons/asset-brown';
const assetPurpleIcon = lighthouseUrl + 'icons/asset-icons/asset-purple';
const assetBlackIcon = lighthouseUrl + 'icons/asset-icons/asset-black';

// A map of RFS categories to icons
const rfsIcons = {
  'Not Applicable': 'icons/rfs_not_applicable.png',
  Advice: 'icons/rfs_advice.png',
  'Watch and Act': 'icons/rfs_watch_act.png',
  'Emergency Warning': 'icons/rfs_emergency.png',
  unknown: 'icons/rfs_emergency.png',
};

/**
 * Adds a point from RMS data to the map layer.
 *
 * @param mapLayer the layer to add to.
 * @param point the point to add.
 * @param icon the icon.
 */
function addTransportPoint(mapLayer, point, icon) {
  let lat = point.geometry.coordinates[1];
  let lon = point.geometry.coordinates[0];

  let name = point.properties.displayName;

  let created = moment(point.properties.created).format('DD/MM/YYYY HH:mm:ss');
  let createddiff = moment(point.properties.created).fromNow();

  let updated = moment(point.properties.lastUpdated).format(
    'DD/MM/YYYY HH:mm:ss',
  );
  let updateddiff = moment(point.properties.lastUpdated).fromNow();

  let dateDetails = `<div class="dateDetails">\
    <div><span class="dateDetailsLabel">Created: </span> ${created}</div>\
    <div><span class="dateDetailsLabel">Created: </span> ${createddiff}</div>\
    <div><span class="dateDetailsLabel">Updated: </span> ${updated}</div>\
    <div><span class="dateDetailsLabel">Updated: </span> ${updateddiff}</div>\
    </div>`;

  let details = `<div><strong>${point.properties.headline}</strong></div>\
    <div style="margin-top:0.5em">${point.properties.adviceA}</div>\
    <div>${point.properties.adviceB}</div>\
    <div>${point.properties.otherAdvice}</div>\
    ${dateDetails}`;

  console.debug(`RMS incident at [${lat},${lon}]: ${name}`);
  mapLayer.addImageMarker(lat, lon, icon, name, details);
}

/**
 * Shows cameras from RMS.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showTransportCameras(mapLayer, data) {
  console.info('showing RMS cameras');

  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let feature = data.features[i];

      if (feature.geometry.type.toLowerCase() === 'point') {
        //default incase that fucks up.
        var icon = `https://www.livetraffic.com/assets/icons/map/others/camera-${feature.properties.direction}.svg`;
        console.log(feature.properties.direction);

        let lat = feature.geometry.coordinates[1];
        let lon = feature.geometry.coordinates[0];

        let name = feature.properties.title;

        let details =
          feature.properties.view +
          "<br><br><div style='height:190px;width:240px;display:block'><a target='_blank' href='" +
          feature.properties.href +
          "'><img width='100%' src=" +
          feature.properties.href +
          '></img></a></div><sub>Click image to enlarge</sub>';

        console.debug(`Camera at [${lat},${lon}]: ${name}`);
        mapLayer.addImageMarker(lat, lon, icon, name, details);

        count++;
      }
    }
  }
  console.info(`added ${count} RMS camera markers`);
}

/**
 * Shows flooding as reported by RMS.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showTransportFlooding(mapLayer, data) {
  console.info('showing RMS reported flooding');

  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let feature = data.features[i];

      if (feature.geometry.type.toLowerCase() === 'point') {
        let icon =
          'https://www.livetraffic.com/assets/icons/map/other-hazards/flood.svg';
        addTransportPoint(mapLayer, feature, icon);
        count++;
      }
    }
  }
  console.info(`added ${count} RMS flooding markers`);
}

/**
 * Shows RMS incidents.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showTransportIncidents(mapLayer, data) {
  console.info('showing RMS incidents');

  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let feature = data.features[i];
      if (feature.geometry.type.toLowerCase() === 'point') {
        let icon =
          'https://www.livetraffic.com/assets/icons/map/general-hazards/moderate-now.svg';

        switch (feature.properties.mainCategory) {
          case 'Hazard':
            icon =
              'https://www.livetraffic.com/assets/icons/map/general-hazards/moderate-now.svg';
            break;
          case 'Crash':
            icon =
              'https://www.livetraffic.com/assets/icons/map/crashes/moderate-now.svg';
            break;
          case 'Breakdown':
            icon =
              'https://www.livetraffic.com/assets/icons/map/breakdowns/moderate-now.svg';
            break;
          case 'Traffic lights blacked out':
            icon =
              'https://www.livetraffic.com/assets/icons/map/other-hazards/tralights.svg';
            break;
          case 'Changed traffic conditions':
            icon =
              'https://www.livetraffic.com/assets/icons/map/changed-traffic/moderate-now.svg';
            break;
        }
        addTransportPoint(mapLayer, feature, icon);
        count++;
      }
    }
  }
  console.info(`added ${count} RMS incidents`);
}

/**
 * Shows SES LHQ's.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */

function showLhqs(mapLayer, data) {
  console.info('showing LHQs');
  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let hq = data.features[i];

      let lat = hq.geometry.coordinates[1];
      let lon = hq.geometry.coordinates[0];

      let name = hq.properties.HQNAME;

      let unitCode = hq.properties.UNIT_CODE;

      let details = `<div id='lhqPopUp'>\
            <div id='lhqCode' style="width:50%;margin:auto;text-align:center;font-weight: bold;">${unitCode}</div>\
            <div id='lhqNameHolder' style="display:none">Unit Name: <span id='lhqName'>${hq.properties.HQNAME}</span></div>\
            <div id='lhqStatusHolder' style="width:50%;margin:auto;text-align:center;"><span id='lhqStatus'>-Loading-</span></div>\

            <div id='lhqacredHolder' style="padding-top:10px;width:100%;margin:auto">\
            <table id='lhqacred' style="width:100%;text-align: center;">\
            <tr>\
            <th style="text-align: center;width:100%">Available SRB Roles</th>\
            </tr>\
            </table>\
            </div>\

            <div id='lhqJobCountHolder' style="padding-top:10px;width:100%;margin:auto">\
            <table style="width:100%;text-align: center;">\
            <tr>\
            <th style="text-align: center;width:50%">Current Jobs</th>\
            <th style="text-align: center;width:50%">Current Teams</th>\
            </tr>\
            <tr>\
            <td id='lhqJobCount'>-Loading-</td>\
            <td id='lhqTeamCount'>-Loading-</td>\
            </tr>\
            </table>\
            </div>\

            <div id='lhqContactsHolder' style="padding-top:10px;width:100%;margin:auto">\
            <table id='lhqContacts' style="width:100%;text-align: center;">\
            <tr>\
            <td colspan="2" style="font-weight: bold">Contact Details</td>
            </tr>\
            <tr>\
            <th style="text-align: center;width:50%">Name</th>\
            <th style="text-align: center;width:50%">Detail</th>\
            </tr>\
            </table>\
            </div>\
            <div style="text-align: center;padding-top:10px;width:100%;margin:auto;color: blue;text-decoration: underline;cursor:cell">\
            <div id='filterTo' >Set HQ Filter To ${unitCode}</div>\
            <div id='filterClear' >Clear HQ Filter</div>
            </div>\
            </div>`;

      let icon = lighthouseUrl + 'icons/ses.png';

      console.debug(`SES LHQ at [${lat},${lon}]: ${name}`);
      mapLayer.addImageMarker(lat, lon, icon, name, details);
      count++;
    }
  }
  console.info(`added ${count} SES LHQs`);
}

/**
 * Shows SES LHQ's.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */

function showSrbs(mapLayer, data) {
  console.info('showing SRB Locations');
  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let hq = data.features[i];

      let lat = hq.geometry.coordinates[1];
      let lon = hq.geometry.coordinates[0];

      let name = hq.properties.rescueOrganisation;

      let unitCode = hq.properties.name;

      let details = `<div id='srbPopUp'>\
            <div id='lhqCode' style="width:50%;margin:auto;text-align:center;font-weight: bold;">${unitCode}</div>\
            <div id='lhqNameHolder' style="display:none">Unit Name: <span id='lhqName'>${hq.properties.rescueOrganisation}</span></div>\

            <div id='lhqacredHolder' style="padding-top:10px;width:100%;margin:auto">\
            <table id='lhqacred' style="width:100%;text-align: center;">\
            <tr>\
            <th style="text-align: center;width:100%">Accredited SRB Roles</th>\
            </tr>\
            <tr><td>${hq.properties.accreditedFor}</td></tr>
            </table>\
            </div>\

            <div id='lhqContactsHolder' style="padding-top:10px;width:100%;margin:auto">\
            <table id='lhqContacts' style="width:100%;text-align: center;">\
            <tr>\
            <td colspan="2" style="font-weight: bold">Contact Details</td>
            </tr>\
            <tr>\
            <th style="text-align: center;width:50%">Name</th>\
            <th style="text-align: center;width:50%">Detail</th>\
            </tr>\
            <tr><td>SOC </td><td>02 111 222</td></tr>
            </table>\
            </div>\
            </div>\
            </div>`;

      let icon = lighthouseUrl + 'icons/frnsw.png';

      console.debug(`SRB Unit at [${lat},${lon}]: ${name}`);
      mapLayer.addImageMarker(lat, lon, icon, name, details);
      count++;
    }
  }
  console.info(`added ${count} SRB units`);
}

/**
 * Show rural fires on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showRuralFires(mapLayer, data) {
  console.info('showing RFS incidents');

  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let fire = data.features[i];

      if (fire.geometry.type.toLowerCase() === 'geometrycollection') {
        let name = fire.properties.title;
        let details = fire.properties.description;
        let category = fire.properties.category;

        let relativeIcon = rfsIcons[category] || rfsIcons['unknown'];
        let icon = lighthouseUrl + relativeIcon;

        fire.geometry.geometries.reverse(); //draw the point first then the polygon (rfs seem to always list point last)
        for (let j = 0; j < fire.geometry.geometries.length; j++) {
          let geometry = fire.geometry.geometries[j];

          if (geometry.type.toLowerCase() === 'polygon') {
            let polygonPoints = geometry.coordinates[0];
            mapLayer.addPolygon(
              polygonPoints,
              '#FF4500',
              [100, 100, 100, 0.5],
              3,
              SimpleLineSymbol.STYLE_SOLID,
              name,
              details,
            );
          } else if (geometry.type.toLowerCase() === 'geometrycollection') {
            for (let k = 0; k < geometry.geometries.length; k++) {
              mapLayer.addPolygon(
                geometry.geometries[k].coordinates[0],
                '#FF4500',
                [100, 100, 100, 0.5],
                3,
                SimpleLineSymbol.STYLE_SOLID,
                name,
                details,
              );
            }
          } else if (geometry.type.toLowerCase() === 'point') {
            let lat = geometry.coordinates[1];
            let lon = geometry.coordinates[0];

            mapLayer.addImageMarker(lat, lon, icon, name, details);
          }
        }
      } else if (fire.geometry.type.toLowerCase() === 'point') {
        let lat = fire.geometry.coordinates[1];
        let lon = fire.geometry.coordinates[0];

        let name = fire.properties.title;
        let details = fire.properties.description;
        let category = fire.properties.category;

        let relativeIcon = rfsIcons[category] || rfsIcons['unknown'];
        let icon = lighthouseUrl + relativeIcon;

        console.debug(`RFS incident at [${lat},${lon}]: ${name}`);
        mapLayer.addImageMarker(lat, lon, icon, name, details);
        count++;
      }
    }
  }
  console.info(`added ${count} RFS incidents`);
}

/**
 * Show SES team locations on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showSesTeamsLocations(mapLayer, data) {
  console.info('showing SES teams');

  let jobOffsets = {};
  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let team = data.features[i];

      if (team.geometry.type.toLowerCase() === 'point') {
        let lat = team.geometry.coordinates[1];
        let lon = team.geometry.coordinates[0];

        let jobId = team.properties.jobId;
        let name = team.properties.teamCallsign;

        let teamIcon = teamEnrouteIcon;
        let status = 'Enroute';
        if (team.properties.onsite) {
          teamIcon = teamOnsiteIcon;
          status = 'On-site';
        }
        if (team.properties.offsite) {
          teamIcon = teamOffsiteIcon;
          status = 'Off-site';
        }

        let details = `<div>\
                <div><a target='_blank' href="${location.origin}/Teams/${team.properties.teamId}/Edit">${team.properties.teamCallsign}</a> - ${status}</div>\
                <div>Job ID: ${team.properties.jobId} <a href=${location.origin}/Jobs/${team.properties.jobId} target='_blank'>View Job Details</a></div>\
                </div>`;

        let jobOffset = jobOffsets[jobId] || 0;
        jobOffsets[jobId] = jobOffset + 1;

        console.debug(`SES team at [${lat},${lon}]: ${name}`);
        let marker = MapLayer.createImageMarker(teamIcon);
        marker.setOffset(16, -16 * jobOffset);
        mapLayer.addMarker(lat, lon, marker, name, details);
        mapLayer.addTextSymbol(lat, lon, name, 50, -16 * jobOffset - 4);
        count++;
      }
    }
  }
  console.info(`added ${count} SES teams`);
}

/**
 * Show SES team locations on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showSesFilteredAssets(mapLayer, data) {
  console.info('showing SES Filtered Assets');

  let count = 0;
  if (data && data.length > 0) {

    for (let i = 0; i < data.length; i++) {
      const asset = data[i];
      let lat = asset.geometry.coordinates[1];
      let lon = asset.geometry.coordinates[0];
      let details = `<span class="label tag tag-disabled">${
        asset.capability
      }</span><span class="label tag tag-disabled">Vehicle</span>
                <br><br>
                <p><b>${lat}</b>, <b>${lon}</b></p>
                <p ${
                  moment().diff(asset.lastSeen, 'days') > 1
                    ? 'style=color:red'
                    : ''
                }>
                (last seen: ${asset.lastSeen == 0 ? 'never' : moment(asset.lastSeen).format('YYYY.MM.DD HH:mm')})<br>
                (last seen: ${moment(asset.lastSeen).fromNow()})
                </p>
                <p>Talkgroup: <b>${
                  asset.talkGroup
                }</b><br>(last activity: ${
        asset.talkGroupLastUpdated
      })<br>
                <hr>
                <div>License Plate: <b>${
                  asset.licensePlate
                }</b></div>
                <p></p>`;

      console.debug(`Asset at [${lat},${lon}]: ${name}`);

      // const assetIcon = lighthouseUrl + 'icons/asset.png';
      // const assetOrangeIcon = lighthouseUrl + 'icons/asset-orange.png';
      // const assetRedIcon = lighthouseUrl + 'icons/asset-red.png';
      // const assetBlueIcon = lighthouseUrl + 'icons/asset-blue.png';
      // const assetOrangeIcon = lighthouseUrl + 'icons/asset-orange.png';
      // const assetYellowIcon = lighthouseUrl + 'icons/asset-yellow.png';
      // const assetBrownIcon = lighthouseUrl + 'icons/asset-brown.png';
      let markerIcon = assetIcon;
      switch (asset.properties.capability) {
        case 'Bus':
          markerIcon = assetYellowIcon;
          break;
        case 'Command':
          markerIcon = assetBlueIcon;
          break;
        case 'Community First Responder':
          markerIcon = assetRedIcon;
          break;
        case 'General Purpose':
          markerIcon = assetPurpleIcon;
          break;
        case 'Logistics':
          markerIcon = assetBrownIcon;
          break;
        case 'Light Storm':
          markerIcon = assetOrangeIcon;
          break;
        case 'Medium Storm':
          markerIcon = assetOrangeIcon;
          break;
        case 'Light Rescue':
          markerIcon = assetRedIcon;
          break;
        case 'Medium Rescue':
          markerIcon = assetRedIcon;
          break;
        case 'Heavy Rescue':
          markerIcon = assetRedIcon;
          break;
        case 'SHQ Pool':
          markerIcon = assetBrownIcon;
          break;
      }

      if (asset.type == 'telematics') {
        markerIcon = assetBlackIcon;
      }

      if (moment().diff(asset.lastSeen, 'days') > 1) {
        markerIcon = `${markerIcon}-light`;
      }

      markerIcon = `${markerIcon}.png`;

      let marker = MapLayer.createImageMarker(markerIcon, 48, 0, 15);

      mapLayer.addMarker(
        lat,
        lon,
        marker,
        `${asset.name.replace('Tele', 'Telematics').replace('PSN', 'PSN Radio')} ${asset.entity != "N/A" ? '('+asset.entity+')' : ''}`,
        details,
      );
      mapLayer.addTextSymbol(lat, lon, `${asset.unitCode.trim()}`, 0, 23, 'white'); //8 offset normally
      mapLayer.addTextSymbol(lat, lon, `${asset.vehCode.trim()}`, 0, 11, 'white'); //-4 offset normally

      count++;
    }
  }
  console.info(`added ${count} SES assets`);
}

/**
 * Builds the params string for the helicopter's update request.
 *
 * @returns the params.
 */
function buildHeliParams() {
  // Build the query url
  let params = '';
  for (let i = 0; i < aircraft.length; i++) {
    params += i === 0 ? '?' : '&';
    params += 'icao24=' + aircraft[i].icao24.toLowerCase();
  }

  return params;
}

/**
 * Shows the current hazard watch hazards.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showHazardWatch(mapLayer, data) {
  console.info('showing hazard watch');
  data.incidents.forEach(function (hazard) {
    //TODO Hazard Watch
    console.log(hazard);

    // switch (hazard.senderName) {
    //   case "NSW Rural Fire Service":
    //     break
    //   case "NSW State Emergency Service":
    //     break
    // }




    // let description = $(`
    // <table style="width: 100%;">
    // </table>`);

    // let headline = hazard.headline;

    // let icon = lighthouseUrl + 'icons/hz_flood.svg';

    // let subText = hazard.incidentType;

    // //work out the top level icon first
    // switch (hazard.hazardType) {
    //   case 'Flood':
    //     icon = lighthouseUrl + 'icons/hz_flood.svg';
    //     break;
    // }

    //   headline = hazard.headline;

    //   description.append(`<tbody class="hazard-hover-table"><tr>
    //     <td rowspan="2" style="width: 25%; padding-left: 5px"><object data="${icon}" type="image/svg+xml"></object></td>
    //     <td style="width: 70%; ">${hazard.areaName}</td>
    //     <td rowspan="2" style="width: 5%;padding-right: 5px"><a style="display: block;" href="https://hazardwatch.gov.au/warnings/${
    //       hazard.id
    //     }" target="_blank"><object style="pointer-events: none;" data="${
    //     lighthouseUrl + 'icons/hz_arrow.svg'
    //   }" type="image/svg+xml"></object></a></td>
    //     </tr>
    //     <tr>
    //     <td style=" padding-bottom: 10px;">${subText}<br><span style="font-weight: bold;" >${moment(
    //     hazard.issuedAt,
    //   ).format('h:mma ddd D MMM z')}</span></td>
    //     </tr></tbody>`);
    

    // // if (hazard.geometries[0].type == 'Polygon') {
    // //   let polygonPoints = hazard.geometries[0].coordinates[0];
    // //   mapLayer.addPolygon(
    // //     polygonPoints,
    // //     '#000000',
    // //     [100, 100, 100, 0.2],
    // //     3,
    // //     SimpleLineSymbol.STYLE_SHORTDOT,
    // //     headline,
    // //     description.prop('outerHTML'),
    // //   );
    // // }
    // // if (hazard.geometries[0].type == 'MultiPolygon') {
    // //   let polygonPoints = hazard.geometries[0].coordinates[0][0];
    // //   mapLayer.addPolygon(
    // //     polygonPoints,
    // //     '#000000',
    // //     [100, 100, 100, 0.2],
    // //     3,
    // //     SimpleLineSymbol.STYLE_SHORTDOT,
    // //     headline,
    // //     description.prop('outerHTML'),
    // //   );
    // // }

    // // if (hazard.geometries[1].type == 'Point') {
    // //   mapLayer.addImageMarker(
    // //     hazard.geometries[1].coordinates[1],
    // //     hazard.geometries[1].coordinates[0],
    // //     icon,
    // //     headline,
    // //     description.prop('outerHTML'),
    // //   );
    // // }

    // //  if (hazard.clusteredWarnings.length) {
    // //     hazard.clusteredWarnings.forEach(function(clustered) {

    // //     })
    // //  }
  });
}

/**
 * Shows the current position of known rescue helicopters on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showRescueHelicopters(mapLayer, data) {
  console.info('showing rescue helicopters');

  let count = 0;
  let updatedAircraft = new Set();

  if (data && data.states) {
    for (let i = 0; i < data.states.length; i++) {
      let icao24 = data.states[i][0].toLowerCase();
      let positionUpdated = data.states[i][3];
      let lon = data.states[i][5];
      let lat = data.states[i][6];
      let alt = data.states[i][7];
      let heading = data.states[i][10] || 0;

      // Save off the updated position
      if (positionUpdated) {
        let heli = findAircraftById(icao24);
        updatedAircraft.add(icao24);
        let position = new AircraftPosition(
          heli,
          positionUpdated,
          lat,
          lon,
          alt,
          heading,
        );
        position.save();
        aircraftLastPositions[icao24] = position;
      }

      addAircraftMarker(
        mapLayer,
        icao24,
        positionUpdated,
        lat,
        lon,
        alt,
        heading,
      );

      count++;
    }
  }

  console.info(`added ${count} rescue helicopters`);

  // Go through the known aircraft, and put down markers for any we didn't just see
  for (let i = 0; i < aircraft.length; i++) {
    let currentAircraft = aircraft[i];
    let icao24 = currentAircraft.icao24.toLowerCase();

    if (!updatedAircraft.has(icao24)) {
      let lastKnownPosition = aircraftLastPositions[icao24];

      if (lastKnownPosition && lastKnownPosition.aircraft.heli) {
        let positionUpdated = lastKnownPosition.lastUpdate;
        let lat = lastKnownPosition.lat;
        let lon = lastKnownPosition.lon;
        let alt = lastKnownPosition.alt;
        let heading = lastKnownPosition.heading;

        addAircraftMarker(
          mapLayer,
          icao24,
          positionUpdated,
          lat,
          lon,
          alt,
          heading,
          helicopterLastKnownIcon,
        );
      }
    }
  }
}

/**
 * Adds an aircraft marker to the map layer.
 *
 * @param mapLayer the layer to add to.
 * @param icao24 the ICAO24 address.
 * @param positionUpdated the
 * @param lat the aircraft latitude.
 * @param lon the aircraft longitude.
 * @param alt the aircraft altitude.
 * @param heading the aircraft heading.
 */
function addAircraftMarker(
  mapLayer,
  icao24,
  positionUpdated,
  lat,
  lon,
  alt,
  heading,
  icon,
) {
  let updated = 'unknown';
  let updatedMoment = 'unknown';

  if (positionUpdated) {
    updated = moment(positionUpdated * 1000).format('DD/MM/YY HH:mm:ss');
    updatedMoment = moment(positionUpdated * 1000).fromNow();
  }

  let heli = findAircraftById(icao24);
  let name = heli.name + ' ' + heli.rego + ' - ' + heli.operator;
  if (!icon) {
    icon = heli.getIcon();
  }

  let details = `<div>Model: ${heli.model}</div>\
    <div style="margin-top:0.5em"><strong>Lat:</strong> ${lat}<br><strong>Lon:</strong> ${lon}<br><strong>Alt:</strong> ${alt}</div>\
    <div class="dateDetails">\
    <div><span class="dateDetailsLabel">Last Position Update: </span> ${updated}</div>\
    <div><span class="dateDetailsLabel">Last Position Update: </span> ${updatedMoment}</div>\
    </div>\
    <div>Flightradar24: \
    <a target='_blank' href="https://www.flightradar24.com/${heli.name}">[current]</a>\
    <a target='_blank' href="https://www.flightradar24.com/data/aircraft/${heli.rego}">[history]</a>\
    </div>`;

  console.debug(`aircraft at [${lat},${lon}]: ${name}`);
  let marker = MapLayer.createImageMarker(icon, name, details);
  marker.setWidth(32);
  marker.setHeight(32);
  marker.setAngle(heading);
  mapLayer.addMarker(lat, lon, marker, name, details);
}

/**
 * Shows the current power outages on the map.
 *
 * @param mapLayer the map layer to add to.
 * @param data the data to add to the layer.
 */
function showPowerOutages(mapLayer, data) {
  console.info('showing power outages');

  let count = 0;
  if (data && data.features) {
    for (let i = 0; i < data.features.length; i++) {
      let feature = data.features[i];

      const PowerOutageDetails = function (source) {
        var name,
          start,
          end,
          reason,
          status,
          type,
          CustomerAffected,
          contact = 'Unknown';
        switch (source.owner) {
          case 'EndeavourEnergy':
            name = 'Endeavour Energy: ' + source.properties.incidentId;
            start = moment(source.properties.startDateTime).format(
              'DD/MM/YY HH:mm:ss',
            );
            end = moment(source.properties.endDateTime).format(
              'DD/MM/YY HH:mm:ss',
            );
            reason = source.properties.reason;
            status = source.properties.status;
            type = source.properties.outageType;
            if (type == 'U') type = 'Unknown';
            if (type == 'P') type = 'Planned';
            CustomerAffected = source.properties.numberCustomerAffected;
            contact = 'Endeavour Energy 131 003';
            break;
          case 'Ausgrid':
            name = 'Ausgrid: ' + source.properties.incidentId;
            start = moment(source.properties.startDateTime).format(
              'DD/MM/YY HH:mm:ss',
            );
            end = moment(source.properties.endDateTime).format(
              'DD/MM/YY HH:mm:ss',
            );
            reason = source.properties.reason;
            type = source.properties.outageType;
            status = source.properties.status;
            if (status == '') status = 'Unknown';
            type = source.properties.type;
            CustomerAffected = source.properties.numberCustomerAffected;
            contact = 'Ausgrid 13 13 88';
            break;
          case 'EssentialEnergy':
            name = 'Essential Energy: ' + source.id;
            start = /Time Off:<\/span>(.*?)<\/div>/g.exec(
              source.properties.description.value,
            )[1];

            end = /Time On:<\/span>(.*?)<\/div>/g.exec(
              source.properties.description.value,
            )[1];
            if (end == '') end = 'Unknown';
            status = /Status:<\/span>(.*?)<\/div>/g.exec(
              source.properties.description.value,
            );
            if (status) {
              status = status[1];
            } else {
              status = 'NA';
            }
            type = source.properties.outageType;
            if (source.properties.styleUrl.match('unplanned')) {
              type = 'Unplanned';
              reason = 'Unknown';
            } else {
              type = 'Planned';
              reason = /Reason:<\/span>(.*?)<\/div>/g.exec(
                source.properties.description.value,
              )[1];
            }
            CustomerAffected =
              /No\. of Customers affected:<\/span>(\d*)<\/div>/g.exec(
                source.properties.description.value,
              )[1];
            contact = 'Essential Energy 132 080';
            break;
        }

        let dateDetails = `<div class="dateDetails">\
                <div><span class="dateDetailsLabel">Start Time: </span> ${start}</div>\
                <div><span class="dateDetailsLabel">End Time: </span> ${end}</div>\
                </div>`;
        let details = `<div>Affected Customers: ${CustomerAffected}</div>\
                <div>Outage Type: ${type}</div>\
                <div>Reason: ${reason}</div>\
                <div>Status: ${status}</div>\
                ${dateDetails}\
                <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">\
                <hr style="height: 1px;margin-top:5px;margin-bottom:5px">\
                ${contact}\
                </span>`;

        return { name: name, details: details };
      };

      if (feature.geometry.type.toLowerCase() === 'geometrycollection') {
        let details = PowerOutageDetails(feature);

        for (let j = 0; j < feature.geometry.geometries.length; j++) {
          let geometry = feature.geometry.geometries[j];

          if (geometry.type.toLowerCase() === 'polygon') {
            let polygonPoints = geometry.coordinates[0];
            mapLayer.addPolygon(
              polygonPoints,
              '#000000',
              [100, 100, 100, 0.5],
              3,
              SimpleLineSymbol.STYLE_SOLID,
              details.name,
              details.details,
            );
          } else if (geometry.type.toLowerCase() === 'point') {
            let lat = geometry.coordinates[1];
            let lon = geometry.coordinates[0];

            mapLayer.addImageMarker(
              lat,
              lon,
              powerIcon,
              details.name,
              details.details,
            );
          }
        }

        count++;
      } else if (feature.geometry.type.toLowerCase() === 'point') {
        let lat = feature.geometry.coordinates[1];
        let lon = feature.geometry.coordinates[0];

        let details = PowerOutageDetails(feature);

        mapLayer.addImageMarker(
          lat,
          lon,
          powerIcon,
          details.name,
          details.details,
        );
        count++;
      }
    }
  }

  console.info(`added ${count} power outages`);
}

/**
 * Fetch HQ details.
 *
 * @param HQName FULLNAME of HQ. code is too hard to search for without multiple results.
 * @param cb cb
 * @returns something. or null. //TODO
 */

function fetchHqDetails(HQName, cb) {
  var hq = {};
  $.ajax({
    type: 'GET',
    url: urls.Base + '/Api/v1/Headquarters/Search?Name=' + HQName,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        if (response.responseJSON.Results.length) {
          var v = response.responseJSON.Results[0];
          hq.Entity = v.Entity;
          v.Entity.EntityTypeId = 1; //shouldnt be using entity for filters, so add the missing things
          hq.HeadquartersStatus = v.HeadquartersStatusType.Name;
          fetchHqAccreditations(v.Id, function (acred) {
            hq.acred = [];
            $.each(acred, function (k, v) {
              if (v.HeadquarterAccreditationStatusType.Id == 1) {
                //1 is available. everything else is bad. only return what is avail
                hq.acred.push(v.HeadquarterAccreditationType.Name);
              }
            });
            if (
              typeof hq.contacts !== 'undefined' &&
              typeof hq.currentJobCount !== 'undefined' &&
              typeof hq.currentTeamCount !== 'undefined'
            ) {
              //lazy mans way to only return once all the data is back
              cb(hq);
            }
          });
          fetchHqJobCount(v.Id, function (jobcount) {
            hq.currentJobCount = jobcount; //return a count
            if (
              typeof hq.contacts !== 'undefined' &&
              typeof hq.acred !== 'undefined' &&
              typeof hq.currentTeamCount !== 'undefined'
            ) {
              //lazy mans way to only return once all the data is back
              cb(hq);
            }
          });
          fetchHqTeamCount(v.Id, function (teamcount) {
            hq.currentTeamCount = teamcount; //return a count
            if (
              typeof hq.contacts !== 'undefined' &&
              typeof hq.acred !== 'undefined' &&
              typeof hq.currentJobCount !== 'undefined'
            ) {
              //lazy mans way to only return once all the data is back
              cb(hq);
            }
          });
          fetchHqContacts(v.Id, function (contacts) {
            //lazy mans way to only return once all the data is back
            hq.contacts = contacts; //return them all
            if (
              typeof hq.currentJobCount !== 'undefined' &&
              typeof hq.acred !== 'undefined' &&
              typeof hq.currentTeamCount !== 'undefined'
            ) {
              cb(hq);
            }
          });
        }
      }
    },
  });
}

/**
 * Fetch HQ Job Counts.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchHqJobCount(HQId, cb) {
  $.ajax({
    type: 'GET',
    url:
      urls.Base +
      '/Api/v1/Jobs/Search?StartDate=&EndDate=&Hq=' +
      HQId +
      '&JobStatusTypeIds%5B%5D=2&JobStatusTypeIds%5B%5D=1&JobStatusTypeIds%5B%5D=5&JobStatusTypeIds%5B%5D=4&ViewModelType=5&PageIndex=1&PageSize=100',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.TotalItems); //return the count of how many results.
      }
    },
  });
}

/**
 * Fetch Job.
 *
 * @param jobId.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchJob(jobId, cb) {
  $.ajax({
    type: 'GET',
    url: urls.Base + '/Api/v1/Jobs/' + jobId + '?viewModelType=1',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON); //return the count of how many results.
      }
    },
  });
}

/**
 * Fetch Job Tasking.
 *
 * @param jobId.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchJobTasking(jobId, cb) {
  $.ajax({
    type: 'GET',
    url: urls.Base + '/Api/v1/Tasking/Search?JobIds%5B%5D=' + jobId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON); //return the count of how many results.
      }
    },
  });
}

/**
 * Fetch HQ Team Counts.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */
function fetchHqTeamCount(HQId, cb) {
  $.ajax({
    type: 'GET',
    url:
      urls.Base +
      '/Api/v1/Teams/Search?StatusStartDate=&StatusEndDate=&AssignedToId=' +
      HQId +
      '&StatusTypeId%5B%5D=3&IncludeDeleted=false&PageIndex=1&PageSize=200&SortField=CreatedOn&SortOrder=desc',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.TotalItems); //return the count of how many results.
      }
    },
  });
}

/**
 * Fetch HQ Contacts.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchHqContacts(HQId, cb) {
  $.ajax({
    type: 'GET',
    url:
      urls.Base +
      '/Api/v1/Contacts/Search?HeadquarterIds=' +
      HQId +
      '&PageIndex=1&PageSize=50&SortField=createdon&SortOrder=asc',
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.Results); //return everything as they are all useful
      }
    },
  });
}

/**
 * Fetch HQ Accreditations.
 *
 * @param HQId code of HQ.
 * @para cb cb
 * @returns something. or null. //TODO
 */

function fetchHqAccreditations(HQId, cb) {
  $.ajax({
    type: 'GET',
    url: urls.Base + '/Api/v1/HeadquarterAccreditations/' + HQId,
    beforeSend: function (n) {
      n.setRequestHeader('Authorization', 'Bearer ' + user.accessToken);
    },
    cache: false,
    dataType: 'json',
    complete: function (response, textStatus) {
      if (textStatus == 'success') {
        cb(response.responseJSON.HeadquarterAccreditationMappings);
      }
    },
  });
}

/**
 * Finds an aircraft by it's ICAO-24 ID.
 *
 * @param icao24 the ID.
 * @returns the aircraft, or {@code null} if no match is found.
 */
function findAircraftById(icao24) {
  for (let i = 0; i < aircraft.length; i++) {
    if (aircraft[i].icao24.toLowerCase() === icao24.toLowerCase()) {
      return aircraft[i];
    }
  }

  console.warn('failed to find a helicopter for icao24: ' + icao24);
  return null;
}

/**
 * A class for rescue aircraft details
 */
class Helicopter {
  /**
   * Constructs a new aircraft.
   *
   * @param icao24 the ICAO-24 hex code.
   * @param rego the registration tag, e.g. "VH-TJE".
   * @param name the flight name, e.g. "RSCU201".
   * @param model the model, e.g. "AW-139".
   * @param heli {@code true} if this is a helicopter.
   */
  constructor(icao24, rego, name, model, operator, heli = true) {
    this.icao24 = icao24.toLowerCase();
    this.rego = rego;
    this.name = name;
    this.model = model;
    this.operator = operator;
    this.heli = heli;
  }

  /**
   * Gets an icon for this aircraft.
   *
   * @returns {string} the URL to the icon.
   */
  getIcon() {
    if (this.heli) {
      return lighthouseUrl + 'icons/helicopter.png';
    } else {
      return lighthouseUrl + 'icons/plane.png';
    }
  }
}

/**
 * A class for a holding details of an aircraft position.
 */
class AircraftPosition {
  /**
   * Constructs a new aircraft position.
   *
   * @param aircraft the aircraft details.
   * @param lastUpdate the last update time.
   * @param lat the last known latitude.
   * @param lon the last known longitude.
   * @param alt the last known altitude.
   * @param heading the last known heading.
   */
  constructor(aircraft, lastUpdate, lat, lon, alt, heading) {
    this.aircraft = aircraft;
    this.lastUpdate = lastUpdate;
    this.lat = lat;
    this.lon = lon;
    this.alt = alt;
    this.heading = heading;
  }

  /**
   * Saves this position into local storage.
   */
  save() {
    let icao24 = this.aircraft.icao24;
    localStorage.setItem(
      'Lighthouse-last-position-' + icao24,
      JSON.stringify(this),
    );
  }

  /**
   * Loads a position from local storage.
   *
   * @param icao24 the ICAO24 address.
   * @return an AircraftPosition, or undefined.
   */
  static load(icao24) {
    icao24 = icao24.toLowerCase();
    let cachedLastPosition = localStorage.getItem(
      'Lighthouse-last-position-' + icao24,
    );
    if (cachedLastPosition) {
      return JSON.parse(cachedLastPosition);
    }
  }
}

// A list of rescue helicopters
const aircraft = [
  // Toll Air Ambulance
  new Helicopter('7C6178', 'VH-TJE', 'RSCU201', 'AW-139', 'Toll Air'),
  new Helicopter('7C6179', 'VH-TJF', 'RSCU202', 'AW-139', 'Toll Air'),
  new Helicopter('7C617A', 'VH-TJG', 'RSCU203', 'AW-139', 'Toll Air'),
  new Helicopter('7C617B', 'VH-TJH', 'RSCU204', 'AW-139', 'Toll Air'),
  new Helicopter('7C617C', 'VH-TJI', 'RSCU206', 'AW-139', 'Toll Air'),
  new Helicopter('7C617D', 'VH-TJJ', 'RSCU207', 'AW-139', 'Toll Air'),
  new Helicopter('7C617E', 'VH-TJK', 'RSCU208', 'AW-139', 'Toll Air'),
  new Helicopter('7C6182', 'VH-TJO', 'RSCU209', 'AW-139', 'Toll Air'),

  // Careflight
  new Helicopter('7C2A34', 'VH-IME', 'CFH3', 'BK117', 'Careflight'),
  new Helicopter('7C0635', 'VH-BIF', 'CFH4', 'BK117', 'Careflight'),

  // Westpac
  new Helicopter('7C5CC0', 'VH-SLU', 'LIFE21', 'BK117', 'Westpac'),
  new Helicopter('7C5CAC', 'VH-SLA', 'LIFE23', 'BK117', 'Westpac'),
  new Helicopter('7C81CC', 'VH-ZXA', 'WP1', 'AW-139', 'Westpac'),
  new Helicopter('7C81CD', 'VH-ZXB', 'WP2', 'AW-139', 'Westpac'),
  new Helicopter('7C81CE', 'VH-ZXC', 'WP3', 'AW-139', 'Westpac'),
  new Helicopter('7C81CF', 'VH-ZXD', 'WP4', 'AW-139', 'Westpac'),
  new Helicopter('7C25E5', 'VH-HRR', 'WP6', 'BK117', 'Westpac'),

  // PolAir
  new Helicopter('7C4D02', 'VH-PHW', 'POLAIR1', 'EC-AS350B2', 'PolAir'),
  new Helicopter('7C4D03', 'VH-PHX', 'POLAIR2', 'EC-AS355', 'PolAir'),
  new Helicopter('7C4CED', 'VH-PHB', 'POLAIR3', 'EC-AS350B2', 'PolAir'),
  new Helicopter('7C4CF8', 'VH-PHM', 'POLAIR4', 'EC-135', 'PolAir'),
  new Helicopter('7C4D05', 'VH-PHZ', 'POLAIR5', 'Bell 412EPI', 'PolAir'),

  // Royal Australian Navy / CHC
  new Helicopter(
    '7C37B8',
    'VH-LAI',
    'CHOP22',
    'Sikorsky S-76A',
    'Royal Australian Navy',
  ),
  new Helicopter(
    '7C44C8',
    'VH-NVE',
    'CHOP26',
    'AW-139',
    'Royal Australian Navy',
  ),

  // Some QLD based helicopters which may cross south
  // QLD Westpac
  new Helicopter('7C44CA', 'VH-NVG', 'LIFE45', 'EC-135', 'Westpac'),

  // QLD RAAF Rescue helicopter
  new Helicopter('7C37B7', 'VH-LAH', 'CHOP41', 'Sikorsky S-76A', 'RAAF'),

  // RACQ Lifeflight
  new Helicopter('7C759B', 'VH-XIL', 'RSCU511', 'AW139', 'RACQ Lifeflight'),
  new Helicopter('7C7599', 'VH-XIJ', 'RSCU533', 'AW139', 'RACQ Lifeflight'),
  new Helicopter('7C74C6', 'VH-XCO', 'RSCU588', 'Bell 412', 'RACQ Lifeflight'),

  // Some VIC base helicopters which may cross north
  // Victoria Helicopter Emergency Medical Service (HEMS)
  new Helicopter('7C7CC6', 'VH-YXK', 'HEMS1', 'AW-139', 'HEMS'),
  new Helicopter('7C7CC3', 'VH-YXH', 'HEMS2', 'AW-139', 'HEMS'),
  new Helicopter('7C7CC5', 'VH-YXJ', 'HEMS4', 'AW-139', 'HEMS'),
  new Helicopter('7C7CC1', 'VH-YXF', 'HEMS5', 'AW-139', 'HEMS'),

  // RFS fixed wing aircraft
  new Helicopter('A4C031', 'N405LC', 'Thor', 'C130', 'RFS', false),
  new Helicopter('ACC37A', 'N512AX', '', 'DC-10', 'RFS', false), // Bomber 910?

  // Whoa, there appear to be a lot of these...
];

// Some extra data points for dev-time
if (developmentMode) {
  aircraft.push(
    // ASNSW fixed wing
    new Helicopter(
      '7C41DE',
      'VH-NAO',
      'AM262',
      'Super King 350C',
      'ASNSW',
      false,
    ),
    new Helicopter(
      '7C41D9',
      'VH-NAJ',
      'AM292',
      'Super King 350C',
      'ASNSW',
      false,
    ), // Also seen as AM271
    new Helicopter(
      '7C01C2',
      'VH-AMS',
      'AM203',
      'Super King B200C',
      'ASNSW',
      false,
    ),
    new Helicopter(
      '7C01C1',
      'VH-AMR',
      'AM207',
      'Super King B200C',
      'ASNSW',
      false,
    ),
    new Helicopter(
      '7C01C0',
      'VH-AMQ',
      'AM297',
      'Super King B200C',
      'ASNSW',
      false,
    ),

    // Royal Flying Doctor's Service
    new Helicopter(
      '7C3FE2',
      'VH-MWK',
      'FD286',
      'Super King B200C',
      'RFDS',
      false,
    ),
  );
}

var aircraftLastPositions = {};

/**
 * Loads the last known aircraft positions.
 */
function loadAircraftLastKnownPositions() {
  console.debug('loading aircraft last known positions from cache');

  for (let i = 0; i < aircraft.length; i++) {
    let currentAircraft = aircraft[i];
    let icao24 = currentAircraft.icao24.toLowerCase();

    aircraftLastPositions[icao24] = AircraftPosition.load(icao24);
  }
}

// Load all the arcgis classes
// These need to be called in 'eval' wrappers because the JS already in the
// page will have loaded these already, and require doesn't double load modules by-design
const SimpleLineSymbol = eval('require("esri/symbols/SimpleLineSymbol");');

/**
 * A class for helping out with map layer access on the inject script side.
 */
export default class InjectScriptMapManager {
  /**
   * Initialises the map manager.
   *
   * @param filterViewModel the filter view model.
   */
  initialise(filterViewModel) {
    // Send the auth token to the content script

    function sendToken() {
      //send the token every 5 mins as it will change every ~60
      window.postMessage(
        { type: 'LH_USER_ACCESS_TOKEN', token: user.accessToken },
        '*',
      );
    }
    sendToken();
    setInterval(sendToken, 3e5);

    console.debug('Sending base: ' + urls.Base);
    window.postMessage({ type: 'LH_USER_API', base: urls.Base }, '*');

    $('input[type="button"][value="Apply"]').click(function () {
      sendStateToContentScript(filterViewModel);
      console.log('sending entities');
    });

    filterViewModel.unappliedChanges.subscribe(function (val) {
      console.log('unappliedChanges observable flip', val);
      if (val == false) {
        sendStateToContentScript(filterViewModel);
      }
    });

    //first run
    sendStateToContentScript(filterViewModel, true);

    //hide the maximize button
    let max = document.getElementsByClassName('titleButton maximize');
    max[0].classList.add('hidden');

    let map = window['map'];
    let lighthouseMap = new LighthouseMap(map);
    // Layers to show above beacon jobs
    lighthouseMap.createLayer('transport-incidents');
    lighthouseMap.createLayer('transport-flood-reports');
    lighthouseMap.createLayer('transport-cameras');
    lighthouseMap.createLayer('helicopters');
    lighthouseMap.createLayer('ses-teams');

    // Layers to show under beacon jobs
    lighthouseMap.createLayer('power-outages', 1);
    lighthouseMap.createLayer('rfs', 1);
    lighthouseMap.createLayer('lhqs', 3);
    lighthouseMap.createLayer('srbs', 3);

    lighthouseMap.createLayer('ses-assets-filtered', 3);
    lighthouseMap.createLayer('hazard-watch', 3);

    //bind to the click event for the jobs and fiddle with the popups Onclick
    lighthouseMap._map._layers.graphicsLayer3.onClick.after.advice = function (
      event,
    ) {
      var jobid = /\/Jobs\/(\d.*?)"/g.exec(
        event.graphic.infoTemplate.content,
      )[1];

      var details = `<div id='jobPopUp' style="margin-top:-5px">\
            <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">\
            Loading...
            </span>
            </div>`;

      // Show the info window for our point
      lighthouseMap._map.infoWindow.setTitle(event.graphic.infoTemplate.title);
      lighthouseMap._map.infoWindow.setContent(details);
      lighthouseMap._map.infoWindow.show(event.mapPoint); //show the popup

      fetchJob(jobid, function (data) {
        fetchJobTasking(jobid, function (taskingdata) {
          //Tasking

          var c = 0;
          var rows = [];
          $.each(taskingdata.Results, function (k, v) {
            var timeDiff = moment(v.CurrentStatusTime).fromNow();
            var members = $.map(v.Team.Members, function (obj) {
              return obj.Person.FirstName + ' ' + obj.Person.LastName;
            }).join(', ');
            if (members == '') {
              members = 'Empty team';
            }
            c++;
            if (c % 2 || c == 0) {
              //every other row
              rows.push(
                '<tr style="text-transform:uppercase"><td><abbr title="' +
                  members +
                  '">' +
                  v.Team.Callsign +
                  '</abbr></td><td><abbr title="' +
                  timeDiff +
                  '">' +
                  v.CurrentStatus +
                  '</abbr></td></tr>',
              );
            } else {
              rows.push(
                '<tr style="background-color:#f0f0f0;text-transform:uppercase"><td><abbr title="' +
                  members +
                  '">' +
                  v.Team.Callsign +
                  '</abbr></td><td>' +
                  v.CurrentStatus +
                  '</td></tr>',
              );
            }
          });

          if (rows.length == 0) {
            rows.push(
              '<td colspan="2" style="font-style: italic">No Taskings</td>',
            );
          }

          let taskingTable = `<div id='taskingHolder' style="padding-top:10px;width:100%;margin:auto">\
<table id='taskingTable' style="width:100%;text-align: center;">\
<tr>\
<td colspan="2" style="font-weight: bold">Team Tasking</td>
</tr>\
<tr>\
<th style="text-align: center;width:50%">Callsign</th>\
<th style="text-align: center;width:50%">Status</th>\
</tr>\
${rows.join('\r')}
</table>\
</div>`;

          // Job Tags
          var tagArray = [];
          $.each(data.Tags, function (tagIdx, tagObj) {
            tagArray.push(tagObj.Name);
          });
          var tagString = tagArray.length ? tagArray.join(', ') : 'No Tags';

          var bgcolor = 'none';
          var txtcolor = 'black';

          switch (data.JobPriorityType.Description) {
            case 'Life Threatening':
              bgcolor = 'red';
              txtcolor = 'white';
              break;
            case 'Priority Response':
              bgcolor = 'rgb(255, 165, 0)';
              txtcolor = 'white';
              break;
            case 'Immediate Response':
              bgcolor = 'rgb(79, 146, 255)';
              txtcolor = 'white';
              break;
          }

          details = `<div id='jobType' style="margin:auto;text-align:center;font-weight: bold;background-color:${bgcolor};color:${txtcolor}">${
            data.JobType.Name
          } - ${data.JobStatusType.Name}</div>\
                    <div id='jobPriority' style="margin:auto;text-align:center;background-color:${bgcolor};color:${txtcolor}"><span id='lhqStatus'>${
            data.JobPriorityType.Description
          }</span></div>\
                    <div style="display:block;text-align: center;font-weight:bold;margin-top:10px">${
                      data.Address.PrettyAddress
                    }</div>\
                    <div id='JobDetails' style="padding-top:10px;width:100%;margin:auto">\
                    <div id='JobSoS' style="display:block;text-align:center">${
                      data.SituationOnScene != null
                        ? data.SituationOnScene
                        : '<i>No situation on scene available.</i>'
                    }</div>
                    <div id='JobTags' style="display:block;text-align:center;padding-top:10px">${tagString}</div>
                    ${taskingTable}
                    <div style="display:block;text-align:center;padding-top:10px"><a href=${
                      location.origin
                    }/Jobs/${data.Id} target='_blank'>View Job Details</a></div>
                    <span style="font-weight:bold;font-size:smaller;display:block;text-align:center">\
                    <hr style="height: 1px;margin-top:5px;margin-bottom:5px">\
                    Job recieved at ${moment(data.JobReceived).format(
                      'HH:mm:ss DD/MM/YYYY',
                    )}<br>
                    ${
                      data.EntityAssignedTo.ParentEntity
                        ? data.EntityAssignedTo.Code +
                          ' - ' +
                          data.EntityAssignedTo.ParentEntity.Code
                        : data.EntityAssignedTo.Code
                    }
                    </span>`;

          $('#jobPopUp').html(details);
        });
      });
    };

    lighthouseMap.addClickHandler(function (event) {
      if ($(lighthouseMap._map.infoWindow.domNode).find('#lhqPopUp').length) {
        //if this is a HL popup box //TODO extend the object and hold the type in there
        fetchHqDetails($('#lhqName').text(), function (hqdeets) {
          var c = 0;
          $.each(hqdeets.contacts, function (k, v) {
            if (v.ContactTypeId == 4 || v.ContactTypeId == 3) {
              c++;
              if (c % 2 || c == 0) {
                //every other row
                $('#lhqContacts').append(
                  '<tr><td>' +
                    v.Description.replace('Phone', '').replace('Number', '') +
                    '</td><td>' +
                    v.Detail +
                    '</td></tr>',
                );
              } else {
                $('#lhqContacts').append(
                  '<tr style="background-color:#e8e8e8"><td>' +
                    v.Description.replace('Phone', '').replace('Number', '') +
                    '</td><td>' +
                    v.Detail +
                    '</td></tr>',
                );
              }
            }
          });
          if (hqdeets.acred.length > 0) {
            //fill otherwise placeholder
            $.each(hqdeets.acred, function (k, v) {
              $('#lhqacred').append('<tr><td>' + v + '</td></tr>');
            });
          } else {
            $('#lhqacred').append(
              '<tr style="font-style: italic;"><td>None</td></tr>',
            );
          }
          $('#lhqStatus').text(hqdeets.HeadquartersStatus);
          $('#lhqJobCount').text(hqdeets.currentJobCount);
          $('#lhqTeamCount').text(hqdeets.currentTeamCount);

          $('#filterTo').click(function () {
            filterViewModel.selectedEntities.removeAll();
            filterViewModel.selectedEntities.push(hqdeets.Entity);
            filterViewModel.updateFilters();
            lighthouseMap._map.infoWindow.show(event.mapPoint); //show the popup, callsbacks will fill data as it comes in
          });

          $('#filterClear').click(function () {
            filterViewModel.selectedEntities.removeAll();
            filterViewModel.updateFilters();
            lighthouseMap._map.infoWindow.show(event.mapPoint); //show the popup, callsbacks will fill data as it comes in
          });
        });
      }
    });

    if (developmentMode) {
      // Add a test point
      lighthouseMap
        .layers()
        ['default'].addImageMarker(
          -33.798796,
          150.997393,
          lighthouseIcon,
          'Parramatta SES',
          'This is a test marker. It is used to check whether the map access is working',
        );
    }

    window['lighthouseMap'] = lighthouseMap;

    let buttons = [
      'toggleRfsIncidentsBtn',
      'toggleRmsIncidentsBtn',
      'toggleRmsFloodingBtn',
      'toggleRmsCamerasBtn',
      'toggleSesTeamsBtn',
      'toggleSesFilteredAssetsBtn',
      'toggleHazardWatchBtn',
      'toggleHelicoptersBtn',
      'togglelhqsBtn',
      'togglePowerOutagesBtn',
    ];
    buttons.forEach(function (buttonId) {
      if (localStorage.getItem('Lighthouse-' + buttonId) === 'true') {
        let button = $(`#${buttonId}`);
        console.debug(buttonId + ' restoring saved state of clicked');
        button.trigger('click');
      }
    });

    loadAircraftLastKnownPositions();
  }
}
