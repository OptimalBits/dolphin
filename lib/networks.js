

module.exports = function(dolphin){
  var opts = dolphin.opts;

  /**
   * driver=<driver-name> Matches a network’s driver.
     id=<network-id> Matches all or part of a network id.
     label=<key> or label=<key>=<value> of a network label.
     name=<network-name> Matches all or part of a network name.
     type=["custom"|"builtin"] Filters networks by type. The custom keyword returns all user-defined networks.
   **/
  var networks = function(filters){
    return dolphin._list('networks', filters, opts);
  }

/**
 *
 *  Name - The new network’s name. this is a mandatory field
    CheckDuplicate - Requests daemon to check for networks with same name
    Driver - Name of the network driver plugin to use. Defaults to bridge driver
    Internal - Restrict external access to the network
    IPAM - Optional custom IP scheme for the network
    EnableIPv6 - Enable IPv6 on the network
    Options - Network specific options to be used by the drivers
    Labels - Labels to set on the network, specified as a map: {"key":"value" [,"key2":"value2"]}
 */
  networks.create = function (params) {
    // return dolphin._post('networks/create', params, opts);

    // Use docker cmd directly since this endpoint is buggy and complex
    var args = ['network', 'create', '--driver', params.Driver];
    if(params.Internal){
      args.push('--internal');
    }
    args.push(params.Name);

    return dolphin.docker(args).then(function(networkId){
      return {
        Id: networkId
      }
    })
  }

  networks.connect = function (containerId) {
    return dolphin._post('networks/create', {container: containerId}, opts);
  }

  networks.diconnect = function (containerId, force) {
    return dolphin._post('networks/create', {container: containerId, force: force}, opts);
  }

  networks.remove = function (networkId) {
    return dolphin._delete('networks/' + networkId, opts);
  }

  return networks;
}
