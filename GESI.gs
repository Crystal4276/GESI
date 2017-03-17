  // Google ESI (GESI)
  // Modified version of https://github.com/googlesamples/apps-script-oauth2 to work with EVE SSO/ESI endpoints
  //
  // /u/blacksmoke16 @ Reddit
  // @Blacksmoke16#1684 @ Discord
  app_version = '0.2';

  // Setup variables used throughout script
  CLIENT_ID = '7c382c66a6c8487d8b64e50daad86f9b';
  CLIENT_SECRET = 'CwcYrVs05AtIbqZkJH8OrBPYps6MAH72qQ1Gf68t';
  BASE_URL = 'https://esi.tech.ccp.is/v'

  // Setup endpoint and version list
  endpoints = {
      'skillList': {
          'version': 3,
          'url': '/characters/{character_id}/skills/'
      },
      'skillQueue': {
          'version': 2,
          'url': '/characters/{character_id}/skillqueue/'
      },
      'marketPrices': {
          'version': 1,
          'url': '/markets/prices/'
      },
      'CitadelMarketOrders': {
          'version': 1,
          'url': '/markets/structures/{structure_id}/'
      }
  };


  function onOpen() {
      var ui = SpreadsheetApp.getUi();
      // Or DocumentApp or FormApp.
      ui.createMenu('GESI')
          .addItem('Authorize Sheet', 'showSidebar')
          .addSeparator()
          .addItem('Reset Auth', 'clearService')
          .addToUi();
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //                                                                                                  OAth2  Functions                                                                  
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  function getEVEService() {
      // Create a new service with the given name. The name will be used when
      // persisting the authorized token, so ensure it is unique within the
      // scope of the property store.
      return OAuth2.createService('EVE')

          // Set the endpoint URLs, which are the same for all Google services.
          .setAuthorizationBaseUrl('https://login.eveonline.com/oauth/authorize/')
          .setTokenUrl('https://login.eveonline.com/oauth/token')

          // Set the client ID and secret, from the EVE Dev site.
          .setClientId(CLIENT_ID)
          .setClientSecret(CLIENT_SECRET)

          // Set the name of the callback function in the script referenced
          // above that should be invoked to complete the OAuth flow.
          .setCallbackFunction('authCallback')

          // Set the property store where authorized tokens should be persisted.
          .setPropertyStore(PropertiesService.getUserProperties())

          // Set the scopes to request (space-separated).
          .setScope('esi-skills.read_skills.v1 esi-skills.read_skillqueue.v1 esi-markets.structure_markets.v1')

          // Requests offline access.  Allows token to be refreshed when it expires
          .setParam('access_type', 'offline')

          .setTokenHeaders({
              'Authorization': 'Basic ' + Utilities.base64Encode(CLIENT_ID + ':' + CLIENT_SECRET)
          })
  }

  function showSidebar() {
      var eveService = getEVEService();
      if (!eveService.hasAccess()) {
          var authorizationUrl = eveService.getAuthorizationUrl();
          var template = HtmlService.createTemplate(
              '<a href="<?= authorizationUrl ?>" target="_blank">Authorize</a>.');
          template.authorizationUrl = authorizationUrl;
          var page = template.evaluate();
          SpreadsheetApp.getUi().showSidebar(page);
      }
  }

  function authCallback(request) {
      var eveService = getEVEService();
      var isAuthorized = eveService.handleCallback(request);
      if (isAuthorized) {
          getCharacterDetails_();
          return HtmlService.createHtmlOutput('Success! You can close this tab.');
      } else {
          return HtmlService.createHtmlOutput('Denied. You can close this tab');
      }
  }

  function clearService() {
      OAuth2.createService('EVE')
          .setPropertyStore(PropertiesService.getUserProperties())
          .reset();
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //                                                                                                  Skills                                                                  
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------


  /**
   * Returns a list of Skill names, current points in skill and current level or total skill points.
   * @param {option} option LIST for list of skills, TOTAL for total skill points.
   * @return Returns a list of Skill names, current points in skill and current level or total skill points.
   * @customfunction
   */
  function skills(option) {
      var userProperties = PropertiesService.getUserProperties();
      var eveService = getEVEService();
      var skills = new Array();
      var ids = new Array();
      var response = UrlFetchApp.fetch(BASE_URL + endpoints.skillList.version + endpoints.skillList.url.replace("{character_id}", userProperties.getProperty('character_id')), {
          headers: {
              Authorization: 'Bearer ' + eveService.getAccessToken()
          }
      });

      var response = JSON.parse(response);
      option = option.toLowerCase();

      if (option == 'list') {
          skills.push(['Name', 'Level', 'SP In Skill']);
          for (var i = 0; i < response.skills.length; i++) {
              ids.push(response.skills[i].skill_id);
              skills.push([
                  response.skills[i].skill_id,
                  response.skills[i].current_skill_level,
                  response.skills[i].skillpoints_in_skill
              ]);
          }

          var skill_names = id2name_(ids);

          for (var i = 0; i < skills.length; i++) {
              for (var n = 0; n < skill_names.length; n++) {
                  if (skills[i][0] == skill_names[n].id) {
                      skills[i][0] = skill_names[n].name
                  }
              }
          }
      } else if (option == 'total') {
          skills[0] = 'Total SP'
          skills[1] = response.total_sp;
      }
      return skills;
  }

  /**
   * Returns the user's current skill queue.
   * @return Returns the users' current skill queue.
   * @customfunction
   */
  function skillsQueue() {
      var userProperties = PropertiesService.getUserProperties();
      var eveService = getEVEService();
      var skills = new Array();
      var ids = new Array();
      var response = UrlFetchApp.fetch(BASE_URL + endpoints.skillQueue.version + endpoints.skillQueue.url.replace("{character_id}", userProperties.getProperty('character_id')), {
          headers: {
              Authorization: 'Bearer ' + eveService.getAccessToken()
          }
      });

      var response = JSON.parse(response);
      skills.push(['Name', 'Finished Level', 'Start Date', 'Finish Date', 'Position']);

      for (var i = 0; i < response.length; i++) {
          ids.push(response[i].skill_id);
          skills.push([
              response[i].skill_id,
              response[i].finished_level,
              response[i].start_date,
              response[i].finish_date,
              response[i].queue_position
          ]);
      }

      var skill_names = id2name_(ids);

      for (var i = 0; i < skills.length; i++) {
          for (var n = 0; n < skill_names.length; n++) {
              if (skills[i][0] == skill_names[n].id) {
                  skills[i][0] = skill_names[n].name
              }
          }
      }

      return skills;
  }

  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //                                                                                                  Market                                                                  
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  /**
   * Returns the avgerage and adjusted prices for various itemIDs.
   * @return Returns the avgerage and adjusted prices for various itemIDs.
   * @customfunction
   */
  function marketPrices() {
      var eveService = getEVEService();
      var items = new Array();
      var response = UrlFetchApp.fetch(BASE_URL + endpoints.marketPrices.version + endpoints.marketPrices.url);

      var response = JSON.parse(response);
      items.push(['ID', 'Adjusted Price', 'Average Price']);

      for (var i = 0; i < response.length; i++) {
          items.push([
              response[i].type_id,
              response[i].adjusted_price,
              response[i].average_price
          ]);
      }

      return items;
  }

  /**
   * Returns all market orders in a given structure.
   * @param {structure_id} structure_id ID of the structure to get market orders.
   * @return Returns all market orders in a given structure.
   * @customfunction
   */
  function structureMarketOrders(structure_id) {
      var eveService = getEVEService();
      var items = new Array();
      var response = UrlFetchApp.fetch(BASE_URL + endpoints.CitadelMarketOrders.version + endpoints.CitadelMarketOrders.url.replace("{structure_id}", structure_id), {
          headers: {
              Authorization: 'Bearer ' + eveService.getAccessToken()
          }
      });
      var response = JSON.parse(response);
      items.push(['Order ID', 'Buy Order?', 'Type ID', 'Location ID', 'Price', 'issued', 'Range', 'Duration', 'Min Volume', 'Remaining Volume', 'Total Volume']);

      for (var i = 0; i < response.length; i++) {
          items.push([
              response[i].order_id,
              response[i].is_buy_order,
              response[i].type_id,
              response[i].location_id,
              response[i].price,
              response[i].issued,
              response[i].range,
              response[i].duration,
              response[i].min_volume,
              response[i].volume_remain,
              response[i].volume_total
          ]);
      }

      return items;
  }


  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  //                                                                                                  Private Functions                                                                  
  // -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

  function getCharacterDetails_() {
      var userProperties = PropertiesService.getUserProperties();
      var eveService = getEVEService();
      var response = UrlFetchApp.fetch('https://login.eveonline.com/oauth/verify', {
          headers: {
              Authorization: 'Bearer ' + eveService.getAccessToken()
          }
      });
      response = JSON.parse(response);
      var newProperties = {
          character_id: response.CharacterID,
          characterName: response.CharacterName,
          expires: response.ExpiresOn
      };
      userProperties.setProperties(newProperties);
  }

  function id2name_(ids) {
      var options = {
          'method': 'post',
          'contentType': 'application/json',
          'payload': JSON.stringify(ids)
      }
      var response = UrlFetchApp.fetch('https://esi.tech.ccp.is/v2/universe/names/', options);
      return JSON.parse(response);
  }
