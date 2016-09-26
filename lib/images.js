

module.exports = function(dolphin){
  var opts = dolphin.opts;

  /**
   *
   * filters – a JSON encoded value of the filters (a map[string][]string) to process on the images list. Available filters:
      dangling=true
      label=key or label="key=value" of an image label
      before=(<image-name>[:<tag>], <image id> or <image@digest>)
      since=(<image-name>[:<tag>], <image id> or <image@digest>)
   **/
  var images = function(imageName){
    //return dolphin._list('images', filters, opts);
    return dolphin._get('images/' + imageName + '/json', null, opts);
  }

/**
 *
 *  We use docker command line since building images is quite a complex
 *  operation.
 *  */
  images.build = function (url, name, versions, params, opts) {
    var args = [].concat.apply([], versions.map(function(tag){
      return ['-t', name + ':' + tag];
    }));

    if(params.Labels){
      Object.keys(params.Labels).forEach(function(label){
        args = args.concat('--label', label, params.Labels[label]);
      });
    }

    args.unshift('build');
    args.push(url);

    // TODO: Add options.
    return dolphin.docker(args).then(function(imageId){
      return {
        Id: imageId
      }
    })
  }

  images.push = function(image, tag){
    var url = 'images/'+image+'/push';
    if(tag){
      url += '?tag=' + tag;
    }
    return dolphin._post(url, null, opts);
  }

  return images;
}
