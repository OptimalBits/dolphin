

module.exports = function(dolphin){
  var opts = dolphin.opts;

  /**
   * name=<volume-name> Matches all or part of a volume name.
     dangling=<boolean> When set to true (or 1), returns all volumes that are “dangling” (not in use by a container). When set to false (or 0), only volumes that are in use by one or more containers are returned.
     driver=<volume-driver-name> Matches all or part of a volume driver name.
   **/
  var volumes = function(filters){
    return dolphin._list('volumes', filters, opts);
  }

/**
 *
 * Name - The new volume’s name. If not specified, Docker generates a name.
   Driver - Name of the volume driver to use. Defaults to local for the name.
   DriverOpts - A mapping of driver options and values. These options are passed directly to the driver and are driver specific.
   Labels - Labels to set on the volume, specified as a map: {"key":"value","key2":"value2"}
  */
  volumes.create = function (params) {
    return dolphin._post('volumes/create', params, opts);
  }

  volumes.remove = function (volumeId) {
    return dolphin._delete('volumes/' + volumeId, opts);
  }

  return volumes;
}
