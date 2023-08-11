var _ = require('underscore');
var $ = require('jquery');
var moment = require('moment');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
var DOM = require('jsx-dom-factory').default;

import BeaconClient from '../shared/BeaconClient.js';

import '../../styles/pages/advexport.css';


global.jQuery = $;



var params = getSearchParameters();

var apiHost = params.host
var token = ''
var tokenexp = ''


window.onerror = function(message, url, lineNumber) {
  $('#loading')
    .html('Error loading page<br>' + message + ' Line ' + lineNumber)
    .show();
  return true;
};

var lighthouse_fieldArray = {
  'Job Details': {
    'Identifier': 'Id',
    'ICEMSIncidentIdentifier': 'ICEMS Id',
    'ReferringAgency': 'ICEMS Originator',
    'JobReceived': 'Received',
    'JobAcknowledged': 'Acknowledged',
    'JobCompleted': 'Completed',
    'JobFinalised': 'Finalised',
    'JobPriorityType.Name': 'Priority',
    'JobType.Name': 'Type',
    'JobStatusType.Name': 'Status',
    'Categories': 'Categories',
    'Reconnoitered': 'Reconned',
    'SituationOnScene': 'Situation On Scene',
    'Tags': 'Tags',
    'EntityAssignedTo.Code': 'HQ',
    'LGA': 'LGA',
    'EntityAssignedTo.ParentEntity.Code': 'Region',
    'Event.Identifier': 'Event',
    'Sector.Name': 'Sector'
  },
  'Address Details': {
    'Address.Level': 'Level',
    'Address.StreetNumber': 'Street Number',
    'Address.Street': 'Street Name',
    'Address.Locality': 'Locality',
    'Address.PostCode': 'Postcode',
    'Address.PrettyAddress': 'Pretty Address',
    'Address.AdditionalAddressInfo': 'Additional Address Info',
    'Address.Latitude': 'Latitude',
    'Address.Longitude': 'Longitude',
    'PermissionToEnterPremises': 'Premises Access - Permission Given',
    'howToEnterPremises': 'Premises Access - Info'
  },
  'Caller / Resident Details': {
    'CallerFirstName': 'Caller - First Name',
    'CallerLastName': 'Caller - Last Name',
    'CallerPhoneNumber': 'Caller - Phone Number',
    'ContactFirstName': 'Job Contact - First Name',
    'ContactLastName': 'Job Contact - Last Name',
    'ContactPhoneNumber': 'Job Contact - Phone Number'
  },
  'Special': {
    'ICEMSIUMTransactions': 'ICEMS - Number Of IUM Transactions',
  }
};
var lighthouse_fieldDefaults = [
  'Id',
  'Received',
  'Priority',
  'Type',
  'Status',
  'Situation On Scene',
  'Tags',
  'HQ',
  'Level',
  'Street Number',
  'Street Name',
  'Locality',
  'Postcode',
  'Additional Address Info',
  /*
  'Premises Access - Permission Given' ,
  'Premises Access - Info' ,
  */
  'Caller - First Name',
  'Caller - Last Name',
  'Caller - Phone Number',
  'Job Contact - First Name',
  'Job Contact - Last Name',
  'Job Contact - Phone Number'
];

$(document).ready(function() {

  validateTokenExpiration();
  setInterval(validateTokenExpiration, 3e5);

  var $fieldsetContainer = $('#advexport_fieldsets');
  $.each(lighthouse_fieldArray, function(k, v) {
    var fieldset = (
      <fieldset>
        <legend>{ k }</legend>
          {
          _.map(v, function(label, key) {
            return (
            <label class = "checkbox-inline" >
              <input type = "checkbox" name = "advexportfields[]" value = { key } checked = { lighthouse_fieldDefaults.indexOf(label) >= 0 } />
              { label }
              </label>
            );
          })
        }
      </fieldset>
    );
    $fieldsetContainer.append(fieldset);
  });
  $('input[type="checkbox"][checked="false"]', $fieldsetContainer)
    .prop('checked', false);

  $('#goButton')
    .click(function() {
      var mp = new Object();
      mp.setValue = function(value) { //value between 0 and 1
        $('#loadprogress').css('width', (Math.round(value * 100) + '%'));
        $('#loadprogress').text(Math.round(value * 100) + '%')
      }
      mp.open = function() {
        document.getElementById("loading").style.visibility = 'visible';
        $('#loadprogress').css('width', 1 + '%');
      }
      mp.fail = function() {
        $('#loadprogress').addClass('progress-bar-striped bg-danger');
        $('#loadprogress').text('Error Loading')
      }
      mp.close = function() {
        document.getElementById("loading").style.visibility = 'hidden';
      }
      RunForestRun(mp);
    });

});


function getSearchParameters() {
  var prmstr = window.location.search.substr(1);
  return prmstr != null && prmstr != '' ? transformToAssocArray(prmstr) : {};
}

function transformToAssocArray(prmstr) {
  var params = {};
  var prmarr = prmstr.split('&');
  for (var i = 0; i < prmarr.length; i++) {
    var tmparr = prmarr[i].split('=');
    params[tmparr[0]] = decodeURIComponent(tmparr[1]);
  }
  return params;
}


function validateTokenExpiration() {
  getToken(function() {
    moment().isAfter(moment(tokenexp).subtract(5, "minutes")) && (console.log("token expiry triggered. time to renew."),
      $.ajax({
        type: 'GET',
        url: params.source + "/Authorization/RefreshToken",
        beforeSend: function(n) {
          n.setRequestHeader("Authorization", "Bearer " + token)
        },
        cache: false,
        dataType: 'json',
        complete: function(response) {
          token = response.responseJSON.access_token
          tokenexp = response.responseJSON.expires_at
          chrome.storage.local.set({
            ['beaconAPIToken-' + apiHost]: JSON.stringify({
              token: token,
              expdate: tokenexp
            })
          }, function() {
            console.log('local data set - beaconAPIToken')
          })
          console.log("successful token renew.")
        }
      })
    )
  })
}

//Get times vars for the call
function RunForestRun(mp) {
  getToken(function() {
    mp && mp.open();
    $('#loading')
      .show();
    HackTheMatrix(params.hq, params.host, mp);
  })
}


//make the call to beacon
function HackTheMatrix(id, host, progressBar) {

  var unit = [];
  var start = new Date(decodeURIComponent(params.start));
  var end = new Date(decodeURIComponent(params.end));
  var selectedcolumns = $('input[name="advexportfields[]"]:checked')
    .map(function() {
      return this.value;
    })
    .get();

  if (selectedcolumns.length == 0) {
    console.log('No Fields Selected');
    return false;
  } else {
    console.log('selectedcolumns = %o', selectedcolumns);
  }

  if (typeof id !== 'undefined') {
    id.split(',').forEach(function(d) {
      var newObj = {
        'Id': d
      };
      unit.push(newObj);
    });
  }

  if (unit.length == 0) {
    console.log('No Units Selected');
  } else {
    console.log(unit);
  }

  BeaconClient.job.search(unit, host, start, end, params.userId, token, function(jobs) {
    //console.log(jobs);
    // $(jobs.Results).each(function(j,k){
    //   console.log(k)
    //   console.log(k.Event)
    // })

    //really hacky handling for 0 jobs. below code maps so it handles no results just fine.
    if (jobs.Results.length == 0) {
      alert("No job results returned")
    }

    var beacon_jobs = jobs.Results.map(function(d) {
      var jobRow = [];

      _.each(selectedcolumns, function(key) {
        // Raw Value
        let rawValue;
        try {
          rawValue = key.split('.').reduce(function(obj, i) {
            return obj[i]
          }, d);
        } catch (err) {
          rawValue = ''
        }
        // Special Cases
        //console.log(key)
        switch (key) {
          case 'JobReceived':
            var rawdate = parseISOLocal(d.JobReceived);
            rawValue = rawdate;
            break;
          case 'Tags':
            rawValue = d.Tags.map(function(d) {
              return d.Name
            }).join(',');
            break;
            case 'Categories':
              rawValue = d.Categories.map(function(d) {
                return d.Name
              }).join(',');
              break;
          case 'JobAcknowledged':
            _.each(d.JobStatusTypeHistory.reverse(), function(history) {
              if (history.Name == 'Active') {
                var rawdate = new Date(history.Timelogged);
                rawValue = rawdate;
                return false;
              }
            })
            break;
          case 'JobCompleted':
            _.each(d.JobStatusTypeHistory, function(history) {
              if (history.Name == 'Complete') {
                var rawdate = new Date(history.Timelogged);
                rawValue = rawdate;
                return false;
              }
            })
            break;
          case 'JobFinalised':
            _.each(d.JobStatusTypeHistory, function(history) {
              if (history.Name == 'Finalised') {
                var rawdate = new Date(history.Timelogged);
                rawValue = rawdate;
                return false;
              }
            })
            break;
        }
        if (rawValue == null || rawValue === '') {
          jobRow.push('');
          return; // Continue to next item
        }
        jobRow.push(rawValue);
      });

      return jobRow;
    });

    if (selectedcolumns.indexOf('ICEMSIUMTransactions') != -1) {
      progressBar.setValue(0);
      $('#extra_progress').text("Counting ICEMS Transactions");
      var queue = jobs.Results.length - 1
      var position = 0
      poppy()


    } else {
      progressBar.setValue(1);
      downloadCSV("LighthouseExport-"+Math.floor(Date.now() / 1000)+".csv", beacon_jobs, selectedcolumns);

      progressBar.close();
    }

    function poppy() {
      progressBar.setValue(position / queue);
      $('#extra_progress').text("Counting ICEMS Transactions..." + Math.floor(position / queue * 100) + "%");
      const item = jobs.Results[position]
      const itemPos = position
      position++
      if (item.ICEMSIncidentIdentifier != null) {
        BeaconClient.operationslog.search(item.Id, host, params.userId, token, function(logs) {
          var numberOfIUM = 0
          logs.Results.forEach(function(r) {
            if (r.Subject && r.Subject.indexOf('Incident Update Message') != -1 && r.Subject.indexOf('Incident Update Message Acceptance') == -1) {
              numberOfIUM++
            }
          })
          beacon_jobs[itemPos][selectedcolumns.indexOf('ICEMSIUMTransactions')] = numberOfIUM
          if (position < queue) {
            poppy()
          } else {
            progressBar.setValue(1);
            downloadCSV("LighthouseExport-"+Math.floor(Date.now() / 1000)+".csv", beacon_jobs, selectedcolumns);
            progressBar.close();
            $('#extra_progress').text("");
          }
        })
      } else {
        if (position < queue) {
          poppy()
        } else {
          progressBar.setValue(1);
          downloadCSV("LighthouseExport-"+Math.floor(Date.now() / 1000)+".csv", beacon_jobs, selectedcolumns);
          progressBar.close();
          $('#extra_progress').text("");
        }
      }
    }

  }, function(val, total) {
    progressBar.setValue(val / total);
  });
}

function convertArrayOfObjectsToCSV(args) {
  var result, ctr, keys, columnDelimiter, lineDelimiter, data;

  data = args.data || null;
  if (data == null || !data.length) {
      return null;
  }

  columnDelimiter = args.columnDelimiter || ',';
  lineDelimiter = args.lineDelimiter || '\n';

  keys = args.keys;

  result = '';
  result += keys.join(columnDelimiter);
  result += lineDelimiter;

  data.forEach(function(item) {
      ctr = 0;
      keys.forEach(function() {
          if (ctr > 0) result += columnDelimiter;
          item[ctr] = `"${item[ctr]}"`
          result += item[ctr];
          ctr++;
      });
      result += lineDelimiter;
  });

  return result;
}


function downloadCSV(file, dataIn, keyIn) {
  var csv = convertArrayOfObjectsToCSV({data: dataIn, keys: keyIn});
  if (csv == null)
    return;

  var saveData = (function() {
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style = "display: none";
    return function(data, fileName) {
      let blob = new Blob([data], {
          type: "octet/stream"
        }),
        url = window.URL.createObjectURL(blob);
      a.href = url;
      a.download = fileName;
      a.click();
      //window.URL.revokeObjectURL(url); removed due to chrome race condition resulting in a 404
    };
  }());


  saveData(csv, file);

}

// wait for token to have loaded
function getToken(cb) { //when external vars have loaded
  var waiting = setInterval(function() { //run every 1sec until we have loaded the page (dont hate me Sam)
    chrome.storage.local.get('beaconAPIToken-' + apiHost, function(data) {
      var tokenJSON = JSON.parse(data['beaconAPIToken-' + apiHost])
      if (typeof tokenJSON.token !== "undefined" && typeof tokenJSON.expdate !== "undefined" && tokenJSON.token != '' && tokenJSON.expdate != '') {
        token = tokenJSON.token
        tokenexp = tokenJSON.expdate
        console.log("api key has been found");
        clearInterval(waiting); //stop timer
        cb(); //call back
      }
    })
  }, 200);
}


/*  @param {string} s - an ISO 8001 format date and time string
**                      with all components, e.g. 2015-11-24T19:40:00
**  @returns {Date} - Date instance from parsing the string. May be NaN.
*/
function parseISOLocal(s) {
  var b = s.split(/\D/);
  return new Date(b[0], b[1]-1, b[2], b[3], b[4], b[5]);
}
