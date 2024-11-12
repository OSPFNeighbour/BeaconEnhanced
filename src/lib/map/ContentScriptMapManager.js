const $ = require('jquery');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DOM = require('jsx-dom-factory').default;
import BeaconClient from '../../shared/BeaconClient.js';


const lighthouseIcon = chrome.runtime.getURL('icons/lh-black.png');
const teamIcon = chrome.runtime.getURL('icons/bus.png');
const assetIcon = chrome.runtime.getURL('icons/asset-icons/asset-red.png');
//const hazardWatchIcon = chrome.runtime.getURL('icons/hazardWatch.png');

const helicopterIcon = chrome.runtime.getURL('icons/helicopter.png');
const rfsIcon = chrome.runtime.getURL('icons/rfs_emergency.png');
const lhqIcon = chrome.runtime.getURL('icons/ses.png');
const rmsIcon = chrome.runtime.getURL('icons/rms.png');
const rfscorpIcon = chrome.runtime.getURL('icons/rfs.png');
const sesIcon = chrome.runtime.getURL('icons/ses_corp.png');



/**
 * A class for helping out with map layer access on the content script side.
 */
 export default class ContentScriptMapManager {

    /**
     * Constructs a new map manager.
     */
     constructor() {
        // The map of timers which will update the lighthouse map layers when enabled
        this._timers = {};
    }

    /**
 * Build a modal to inject into the body for asset selection
 */
     static asset_filter_modal()  {
        return $(
    <div id="LHAssetFilterModal" class="modal fade" role="dialog">
<div class="modal-dialog modal-sm" style="width:50%">
  <div class="modal-content">
     <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal">&times;</button>
        <h4 class="modal-title">Lighthouse Asset Filter</h4>
     </div>
     <div class="modal-body">
        <h4>Select assets to show</h4>
        <p/>
        <div class="container-fluid">

           <div class='row' style="display: flex; align-items: center;">
              <div class="col-md-5 text-center">
              <h5>All Assets</h5>
              <input type="text" style="width: 65%; margin:auto; margin-bottom: 5px" id="assetListAllQuickSearch" maxlength="30" class="form-control" placeholder="Filter"></input>
              <div id="asset-map-filter-loading" class="filter-loader-container">
                <div class="filter-loader-background">
                  <div class="filter-loader">Loading...</div>
                </div>
                </div>
                 <select multiple id="assetFilterListAll">
                 </select>
              </div>
              <div class="col-md-2 text-center">
              <div>
                 <div>
                    <button style="margin-bottom: 5px; width: 100px" type="button" class="btn btn-primary" id="teamFilterListAddSelected">Add<span style="margin-left: 10px;" class="glyphicon glyphicon-arrow-right" aria-hidden="true"></span></button>
                 </div>
                 <div>
                    <button style="margin-top: 5px; width: 100px" type="button" class="btn btn-primary" id="teamFilterListRemoveSelected"><span style="margin-right: 10px;" class="glyphicon glyphicon-arrow-left" aria-hidden="true"></span>Remove</button>
                 </div>
                 </div>
              </div>
              <div class="col-md-5 text-center">
              <h5>Selected Assets</h5>
              <input type="text" style="width: 65%; margin:auto; margin-bottom: 5px" id="assetListSelectedQuickSearch" maxlength="30" class="form-control" placeholder="Filter"></input>
                 <select multiple id="assetFilterListSelected">
                 </select>
              </div>
           </div>
        </div>
     </div>
     <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="assetSaveFiltersButton" data-dismiss="modal">Proceed</button>
     </div>
  </div>
</div>
</div>
)
        }


    /** TODO: Fix Hazard Watch
    <span id="toggleHazardWatchBtn" class="label tag tag-lh-filter tag-disabled">
    <img style="max-width: 16px; vertical-align: top;margin-right: 4px;" src={hazardWatchIcon} />
    <span class="tag-text">Hazard Watch</span>
    </span>
    */
   
    /**
     * Creates a menu for the map layers.
     *
     * @returns {*|jQuery|HTMLElement}
     */
     static createLayerMenu() {
        return $(<li id="lhlayers">
            <a href="#" class="js-sub-menu-toggle">
            <img src={lighthouseIcon} style="width:14px;vertical-align:top;margin-right:10px;float:left" />
            <span class="text">Lighthouse</span>
            <i class="toggle-icon fa fa-angle-left"></i>
            </a>
            <ul class="sub-menu ">
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <img src={sesIcon} style="width:14px;vertical-align:sub;margin-right:7px;" />
            <span class="text toggle-tag-text">NSW SES</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="togglelhqsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={lhqIcon} />
            <span class="tag-text">SES LHQs</span>
            </span>
            <span id="toggleSesTeamsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={teamIcon} />
            <span class="tag-text">Team Tasking</span>
            </span>
            <span id="toggleSesFilteredAssetsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; vertical-align: top;margin-right: 4px;" src={assetIcon} />
            <span class="tag-text">Filtered Asset Locations</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <img src={rmsIcon} style="margin-top:4px;width:14px;vertical-align:top;float:left;margin-right:7px;" />
            <span class="text toggle-tag-text">Roads and Maritime Services</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="toggleRmsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/general-hazards/moderate-now.svg" />
            <span class="tag-text">RMS Incidents</span>
            </span>
            <span id="toggleRmsFloodingBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/other-hazards/flood.svg" />
            <span class="tag-text">RMS Flood Reports</span>
            </span>
            <span id="toggleRmsCamerasBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src="https://www.livetraffic.com/assets/icons/map/others/camera-N.svg" />
            <span class="tag-text">RMS Cameras</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <img src={rfscorpIcon} style="width:14px;vertical-align:top;float:left;margin-right:7px;" />
            <span class="text toggle-tag-text">NSW Rural Fire Service</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="toggleRfsIncidentsBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px;vertical-align: top;margin-right: 4px;" src={rfsIcon} />
            <span class="tag-text">RFS Incidents</span>
            </span>
            </li>
            </ul>
            </li>
            <li>
            <a class="js-sub-sub-menu-toggle" href="#">
            <i class="toggle-icon-sub fa fa-bell"></i>
            <span class="text toggle-tag-text">Other</span>
            </a>
            <ul class="sub-sub-menu">
            <li class="clearfix">
            <span id="toggleHelicoptersBtn" class="label tag tag-lh-filter tag-disabled">
            <img style="max-width: 16px; background: #fff;vertical-align: top;margin-right: 4px;" src={helicopterIcon} />
            <span class="tag-text">Rescue Aircraft</span>
            </span>
            <span id="togglePowerOutagesBtn" class="label tag tag-lh-filter tag-disabled">
            <span class="glyphicon glyphicon-flash" aria-hidden="true"></span>
            <span class="tag-text">Power Outages</span>
            </span>
            <span id="toggleSRBUnitsBtn" class="label tag tag-lh-filter tag-disabled">
            <span class="glyphicon glyphicon-bullhorn" aria-hidden="true"></span>
            <span class="tag-text">  Accredited Rescue Units</span>
            </span>
            </li>
            </ul>
            </li>
            </ul>
            </li>);
}

    /**
     * Initialises the map manager.
     */
     initialise() {
        this._registerClickHandler('toggleRfsIncidentsBtn', 'rfs', this._requestRfsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsIncidentsBtn', 'transport-incidents', this._requestTransportIncidentsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsFloodingBtn', 'transport-flood-reports', this._requestTransportFloodReportsLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('toggleRmsCamerasBtn', 'transport-cameras', this._requestTransportCamerasLayerUpdate, 10 * 60000); // every 10 mins
        this._registerClickHandler('toggleHelicoptersBtn', 'helicopters', ContentScriptMapManager._requestHelicoptersLayerUpdate, 10000); // every 10s
        this._registerClickHandler('toggleSesTeamsBtn', 'ses-teams', this._requestSesTeamsLayerUpdate, 5 * 60000); // every 5 minutes
        this._registerClickHandler('toggleSesFilteredAssetsBtn', 'ses-assets-filtered', this._requestSesFilteredAssets, 60000); // every 1 minutes
        //this._registerClickHandler('toggleHazardWatchBtn', 'hazard-watch', this._requestHazardWatchLayerUpdate, 5 * 60000); // every 5 minutes
        this._registerClickHandler('togglePowerOutagesBtn', 'power-outages', this._requestPowerOutagesLayerUpdate, 5 * 60000); // every 5 mins
        this._registerClickHandler('togglelhqsBtn', 'lhqs', this._requestLhqsLayerUpdate, 60 * 60000); // every 60 mins
        this._registerClickHandler('toggleSRBUnitsBtn', 'lhqs', this._requestSrbLayerUpdate, 60 * 60000); // every 60 mins


        window.addEventListener('message', function (event) {
            // We only accept messages from background
            if (event.source !== window)
                return;
            if (event.data.type) {
                if (event.data.type === 'LH_USER_API') {
                    this._base = event.data.base;
                    //console.debug('Got base: ' + this._base);

                } else if (event.data.type === 'LH_USER_ACCESS_TOKEN') {
                    this._token = event.data.token;
                    //console.debug('Got access-token: ' + this._token);

                } else if (event.data.type === 'LH_SELECTED_STATE') {
                    this._hqs = event.data.params.hqs;
                    this._startDate = event.data.params.startDate;
                    this._endDate = event.data.params.endDate;
                    //console.debug('Got hqs: ' + this._hqs);
                    //console.debug('Got start: ' + this._startDate);
                    //console.debug('Got end: ' + this._endDate);
                    if (event.data.params.firstRun !== true) {
                    if (!$('#toggleSesTeamsBtn').hasClass('tag-disabled')) //if the teams button is pressed, teams are shown, update them with the new data
                     {
                        this._requestSesTeamsLayerUpdate()
                     }
                     //TODO: Race condition with on page load and on button click
                     if (!$('#toggleSesFilteredAssetsBtn').hasClass('tag-disabled')) //if the asset button is pressed, teams are shown, update them with the new data
                      {
                         this._requestSesFilteredAssets()
                      }
                    }

    } else if (event.data.type === 'LH_RESPONSE_HELI_PARAMS') {
        let params = event.data.params;
        this._requestLayerUpdate('helicopters', params);

    } else if (event.data.type === 'LH_RESPONSE_TRANSPORT_KEY') {

        let sessionKey = 'lighthouseTransportApiKeyCache';
        let transportApiKeyCache = event.data.key;

        //console.debug('got transport key: ' + transportApiKeyCache);
        sessionStorage.setItem(sessionKey, transportApiKeyCache);
        this._fetchTransportResourceWithKey(transportApiKeyCache, event.data.layer);
    }
}
}.bind(this), false);

}

    /**
     * Registers the click handler on the filter buttons.
     *
     * @param buttonId the button ID.
     * @param layer the map layer to update.
     * @param updateFunction the update function.
     * @param interval the refresh interval.
     * @return timer the timer which refreshes the layer.
     */
     _registerClickHandler(buttonId, layer, updateFunction, interval) {
        console.log(buttonId)
        document.getElementById(buttonId).addEventListener('click',
            function (e) {

                //work out if it was a human or a script that clicked
                let headless = true 
                if (e.pointerType != "") {
                    headless = false
                }

                console.debug(`toggle ${buttonId} clicked`);

                let button = $(`#${buttonId}`);
                let disabled = button.hasClass('tag-disabled');

                localStorage.setItem('Lighthouse-' + buttonId, disabled);

                if (disabled) {
                    updateFunction = updateFunction.bind(this);
                    updateFunction({headless: headless});
                    this._timers[layer] = setInterval(updateFunction, interval);
                    button.removeClass('tag-disabled');
                } else {
                    clearInterval(this._timers[layer]);
                    window.postMessage({type: 'LH_CLEAR_LAYER_DATA', layer: layer}, '*');
                    button.addClass('tag-disabled');
                }
            }.bind(this), false);
    }

    /**
     * Sends a request to the background script to get the LHQ locations.
     */
     _requestLhqsLayerUpdate() {
        console.debug('updating LHQs layer');
        $.getJSON(chrome.runtime.getURL('resources/SES_HQs.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('lhqs', data);
        }.bind(this))
    }

    /**
     * Sends a request to the background script to get the SRB locations.
     */
    _requestSrbLayerUpdate() {
        console.debug('updating SRB Rescue layer');
        $.getJSON(chrome.runtime.getURL('resources/SRB.geojson'), function (data) {
            ContentScriptMapManager._passLayerDataToInject('srbs', data);
        }.bind(this))
    }

    /**
     * Sends a request to the background script to get the latest RFS incidents.
     */
     _requestRfsLayerUpdate() {
        //console.debug('updating RFS layer');
        this._requestLayerUpdate('rfs');
    }

    /**
     * Sends a request to the background script to get the latest transport incidents.
     */
     _requestTransportIncidentsLayerUpdate() {
        //console.debug('updating transport incidents layer');
        this._fetchTransportResource('transport-incidents');
    }

    /**
     * Sends a request to the background script to get the latest transport flood reports.
     */
     _requestTransportFloodReportsLayerUpdate() {
        //console.debug('updating transport incidents layer');
        this._fetchTransportResource('transport-flood-reports');
    }


    /**
     * asks for the cameras via the fetchTransportResource function
     */
     _requestTransportCamerasLayerUpdate() {
        //console.debug('updating transport cameras layer');
        this._fetchTransportResource('transport-cameras');
    }

    _requestPowerOutagesLayerUpdate() {
        //console.debug('updating power-outages layer');
        this._requestLayerUpdate('power-outages')
    }

    _requestHazardWatchLayerUpdate() {
        //console.debug('updating hazard-watch layer');
        this._requestLayerUpdate('hazard-watch')

    }

    /**
     * Requests an update to the SES teams location layer.
     */
     _requestSesTeamsLayerUpdate() {
        //console.debug('updating SES teams layer',this);

        if (!this._token) {
            // If the inject script hasn't sent over the HQs wait a few seconds then retry
            setTimeout(this._requestSesTeamsLayerUpdate.bind(this), 2000);
            return;
        }

        BeaconClient.team.getTeamGeoJson(this._hqs, this._base, this._startDate, this._endDate, 'ContentScriptMapManager', this._token, function(result) {
            ContentScriptMapManager._passLayerDataToInject('ses-teams', result);
        }.bind(this));
    }

    /**
     * Requests an update to the SES filtered asset layer.
     */
     _requestSesFilteredAssets(passedVars) {
        if (!this._token) {
            // If the inject script hasn't sent over the HQs wait a few seconds then retry
            setTimeout(this._requestSesFilteredAssets.bind(this), 2000);
            return;
        } else {
            if (passedVars && passedVars.headless == false) {
                //something about drawing that modal for picking assets
                window.postMessage({type: 'LH_ASSETFILTERMODALCALL'}, '*');
            } else {
                let loadIn = JSON.parse(localStorage.getItem('LighthouseJobViewAssetFilter')) || []
                BeaconClient.asset.filter(loadIn, this._base, 'ContentScriptMapManager', this._token, function(result) {
                    ContentScriptMapManager._passLayerDataToInject('ses-assets-filtered', result);
                }.bind(this),function(error) {
                    console.log(error) 
                  });
            }
      }
    }

    /**
     * Fetches a resource from the transport API.
     *
     * @param layer the layer to fetch, e.g. 'transport-incidents'.
     */
     _fetchTransportResource(layer) {
        let sessionKey = 'lighthouseTransportApiKeyCache';
        let transportApiKeyCache = sessionStorage.getItem(sessionKey);

        if (transportApiKeyCache) {
            //console.debug('Using cached key: ' + transportApiKeyCache);
            this._fetchTransportResourceWithKey(transportApiKeyCache, layer);

        } else {
            //console.debug('Fetching ops log key');
            window.postMessage({type: 'LH_GET_TRANSPORT_KEY', layer: layer}, '*');
        }
    }

    /**
     * Fetches a resource from the transport API.
     *
     * @param layer the layer to fetch.
     * @param apiKey the transport.nsw.gov.au API key.
     */
     _fetchTransportResourceWithKey(apiKey, layer) {
        console.info(`fetching transport resource: ${apiKey} ${layer}`);
        let params = {apiKey: apiKey};
        this._requestLayerUpdate(layer, params)
    }

    /**
     * Sends a request to the background script to get the latest helicopter positions.
     */
     static _requestHelicoptersLayerUpdate() {
        //console.debug('updating transport incidents layer');
        window.postMessage({type: 'LH_REQUEST_HELI_PARAMS'}, '*');
    }

    

    /**
     * Sends a message to the background script with layer name and params.
     * background should reply with a data set or error. reply of data is forwarded
     * to a function to the injected script to be used.
     * @param layer the layer to fetch.
     * @param params an API key or something needed to fetch the resource.
     */
     _requestLayerUpdate(layer, params = {}) {
        chrome.runtime.sendMessage({type: layer, params: params}, function (response) {
            if (response.error) {
                console.error(`Update to ${layer} failed: ${response.error} http-code:${response.httpCode}`);
            } else {
                ContentScriptMapManager._passLayerDataToInject(layer, response)
            }
        }.bind(this));
    }

    /**
     * Sends a message to the injected script with layer name and data.
     * dont expect a response.
     * @param layer the layer to own the data.
     * @param response the data to use.
     */
     static _passLayerDataToInject(layer, response) {
        window.postMessage({type: 'LH_UPDATE_LAYERS_DATA', layer: layer, response: response}, '*');
    }
};
