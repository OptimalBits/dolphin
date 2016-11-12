

module.exports = function (dolphin) {
  var opts = dolphin.opts;

  /**
   *
   * filters – a JSON encoded value of the filters (a map[string][]string) to process on the images list. Available filters:
      dangling=true
      label=key or label="key=value" of an image label
      before=(<image-name>[:<tag>], <image id> or <image@digest>)
      since=(<image-name>[:<tag>], <image id> or <image@digest>)
   **/
  var images = function (imageName) {
    //return dolphin._list('images', filters, opts);
    return dolphin._get('images/' + imageName + '/json', null, opts);
  }

  /**
   *
   *  We use docker command line since building images is quite a complex
   *  operation.
   *  */
  images.build = function (url, name, versions, params) {
    var args = [].concat.apply([], versions.map(function (tag) {
      return ['-t', name + ':' + tag];
    }));

    if (params.Labels) {
      Object.keys(params.Labels).forEach(function (label) {
        args = args.concat('--label', label + '=' + params.Labels[label]);
      });
    }

    if (params.buildargs) {
      Object.keys(params.buildargs).forEach(function (arg) {
        args = args.concat('--build-arg', arg + '=' + params.buildargs[arg]);
      });
    }

    args.unshift('build');
    args.push('-q')
    args.push(url);

    return dolphin.docker(args).then(function (imageId) {
      return {
        Id: imageId.trim()
      }
    })
  }

  images.push = function (image, tag) {
    var url = 'images/' + image + '/push';
    if (tag) {
      url += '?tag=' + tag;
    }
    return dolphin._post(url, null, opts);
  }

  images.tag = function(nameOrId, repo, tag){
    var url = 'images/' + nameOrId + '/tag?repo=' + repo;
    if (tag) {
      url += '&tag=' + tag;
    }
    return dolphin._post(url, null, opts);
  }

  //
  // TODO: registry auth.
  // TODO: default registries, etc.
  //
  var request = require('request');
  images.manifest = function (name, tag) {
    return new Promise(function (resolve, reject) {
      var splitted = name.split('/');
      if (splitted.length > 1) {
        var registry = splitted[0];
        var repo = splitted[1];
        var opts = {
          url: 'https://' + registry + '/v2/' + repo + '/manifests/' + tag,
          method: 'GET',
          json: true,
        }

        request(opts, function (err, response, body) {
          if (err) return reject(err);
          resolve(body);
        });
      }else{
        resolve();
      }
    });
  }

  return images;
}
