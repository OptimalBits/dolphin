var _ = require('lodash');

module.exports = function(dolphin){
  var opts = dolphin.opts;

  /**
   * Gets services.
   * @params id{String} or filters{Object} Optional parameters.
      id=<node id>
      name=<node name>
  **/
  var services = function(filters){
    return dolphin._list('services', filters, opts);
  }

/**
 * Creates a service. For params check
 * https://docs.docker.com/engine/reference/api/docker_remote_api_v1.24/#/create-a-network
 */
  services.create = function (params) {
    return dolphin._post('services/create', params, opts);
  }

  /**
   * Updates a service. Same params as create.
   *
   */
  services.update = function (id, version, params) {
    return dolphin._post('services/' + id + '/update?version=' + version, params, opts);
  }

  /**
   * Removes a service.
   */
  services.remove = function (serviceId) {
    return dolphin._delete('service/' + serviceId, opts);
  }

  return services;
}
