var H5P = H5P || {};

/**
 * Will render a Board game.
 *
 * @param {Array} options
 * @param {int} contentId
 * @returns {H5P.Boardgame} Instance
 */
H5P.Boardgame = function (options, contentId) {
  if (!(this instanceof H5P.Boardgame)) {
    return new H5P.Boardgame(options, contentId);
  }

  var $ = H5P.jQuery;
  var cp = H5P.getContentPath(contentId);

  var texttemplate =
          '<div class="boardgame">' +
          '  <div class="boardgame-intro open">' +
          '    <div class="bgi-content">' +
          '      <h1><%= title %></h1>' +
          '      <p><%= introduction.text %></p>' +
          '      <div class="buttons">' +
          '        <a class="button bgi-start"><%= introduction.startButtonText %></a>' +
          '      </div>' +
          '    </div>' +
          '  </div>' +
          '</div>';

  // An internal Object only available to Board games.
  function HotSpot(dom, hs_params) {
    var defaults = {
      title: 'Hotspot',
      image: undefined, // TODO: Add default images! (in css?)
      passedImage: undefined,
      failedImage: undefined,
      position: new H5P.Coords(),
      action: ''
    };
    var that = this;
    var params = $.extend({}, defaults, hs_params);
    this.passed = false;

    // Render HotSpot DOM elements
    var $hsd = $('<a class="hotspot" title="' + params.title + '" href="#" data-title="' + params.title + '"></a>');
    // Insert DOM in BoardGame
    $('.boardgame', dom).append($hsd);
    $hsd.css({
      left: hs_params.coords.x + 'px',
      top: hs_params.coords.y + 'px',
      width: hs_params.image.width + 'px',
      height: hs_params.image.height + 'px',
      backgroundImage: 'url(' + cp + hs_params.image.path + ')'
    });

    var libraryObject = H5P.libraryFromString(params.action.library);
    this.action = new (H5P.classFromName(libraryObject.machineName))(params.action.params, contentId);

    // Attach event handlers
    $hsd.hover(function () {
      $(this).addClass('hover');
    }, function () {
      $(this).removeClass('hover');
    }).click(function () {
      // Start action
      // - Create container
      $('.boardgame', dom).append('<div class="action-container" id="action-container"></div>');

      // - Attach action
      that.action.attach('action-container');
      $(that.action).on('h5pQuestionSetFinished', function (ev, result) {
        $('#action-container', dom).remove();
        // Update score in hotspot info
        $hsd.attr('title', $hsd.attr('data-title') + ': ' + result.score);
        // Switch background image to passed image.
        that.passed = result.passed;
        if (result.passed) {
          $hsd.css({backgroundImage: 'url(' + cp + hs_params.passedImage.path + ')'});
        } else {
          $hsd.css({backgroundImage: 'url(' + cp + hs_params.failedImage.path + ')'});
        }
        // Trigger further event to boardgame to calculate total score?
        $(that).trigger('hotspotFinished', result);
      });
      return false;
    });
  }

  var defaults = {
    title: '',
    background: {
      path: '',
      width: 635,
      height: 500
    },
    introduction: {
      text: '',
      startButtonText: 'Start game'
    },
    hotspots: [],
    extras: [],
    progress: {
      enabled: false,
      incremental: true,
      includeFailed: false,
      coords: {
        x: 0,
        y: 0,
        w: 200,
        h: 100
      },
      images: []
    },
    endVideo: undefined,
    endResults: {
      text: "You scored @score of @total.<br/>That's @percentage%",
      solutionButtonText: 'Show solution',
      retryButtonText: 'Try again'
    }
  };

  var params = $.extend(true, {}, defaults, options);
  var $myDom, $progress;
  var hotspots = [];
  var template = new EJS({text: texttemplate});

  // Update progress meter.
  var _updateProgress = function () {
    if (!$progress) {
      return;
    }

    // TODO: This only computes for incremental: true, includeFailed: false.
    var c = 0;
    for (var i = 0; i < hotspots.length; i++) {
      if (hotspots[i].passed) {
        c += 1;
      }
    }
    if (params.progress.images.length > c) {
      $progress.css({
        backgroundImage: 'url(' + cp + params.progress.images[c].path + ')',
        width: params.progress.images[c].width + 'px',
        height: params.progress.images[c].height + 'px'
      });
    }
  };

  var _checkIfFinished = function () {
    var c = 0;
    for (var i = 0; i < hotspots.length; i++) {
      if (hotspots[i].passed) {
        c += 1;
      }
    }
    if (c === hotspots.length) {
      // We're done. Start endgame
      _displayEndGame();
    }
    return false;
  };

  var _displayEndGame = function () {
    var displayResults = function () {
      // Calculate final scores
      var total = 0, score = 0, percentage;
      for (var i = 0; i < hotspots.length; i++) {
        var spot = hotspots[i];
        total += spot.action.totalScore();
        score += spot.action.getScore();
      }
      percentage = Math.floor(100*score/total);

      var str = params.endResults.text.replace('@score', score).replace('@total', total).replace('@percentage', percentage);
      $('.bgi-content p', $myDom).html(str);

      // Knapp til fasit
      $('<a class="button bgi-solution">' + params.endResults.solutionButtonText + '</a>').click(function () {
        // TODO: Show solution
      }).appendTo('.bgi-content .buttons', $myDom);

      // Knapp til å begynne på nytt
      $('.bgi-content .bgi-start', $myDom).text(params.endResults.retryButtonText);

      // Slutt-text
      $('.boardgame-intro', $myDom).addClass('open');
    };

    // Show animation if present
    if (params.endVideo !== undefined) {
      H5P.playVideo($('.boardgame', $myDom), params.endVideo, params.skipButtonText, cp, function () {
        displayResults();
      });
    }
    else {
      // Show result page.
      displayResults();
    }
  };

  // Function for attaching the multichoice to a DOM element.
  var attach = function (target) {
    var $target;
    if (typeof(target) === 'string') {
      $target = $('#' + target);
    }
    else {
      $target = $(target);
    }
    // Render own DOM into target.
    $myDom = $target;
    $myDom.html(template.render(params));
    var $boardgame = $('.boardgame', $myDom);
    $boardgame.css({
      backgroundImage: 'url(' + cp + params.background.path + ')',
      width: params.size.width,
      height: params.size.height,
      backgroundSize: params.size.width + 'px ' + params.size.height + 'px'
    });

    // Add click handler to start button.
    if (params.introduction) {
      $('.bgi-start', $boardgame).click(function () {
        var $bgiContent = $('.bgi-content', $boardgame);
        var movePercent = ($bgiContent.height() - $bgiContent.children('h1').height()) / (params.size.height / 100);

        $('.boardgame-intro', $boardgame).css('bottom', '-' + movePercent + '%').removeClass('open');
      });
    }

    // Add hotspots.
    for (var i = params.hotspots.length - 1; i >= 0; i--) {
      var spot = new HotSpot($myDom, params.hotspots[i]);
      hotspots.push(spot);
      // Set event listeners.
      $(spot).on('hotspotFinished', function (ev, result) {
        _updateProgress();
        _checkIfFinished();
      });
    }

    // Start extras
    // for (var j = params.extras.length - 1; j >= 0; j--) {
    //   var a = (H5P.classFromName(params.extras[j].name))($myDom, params.extras[j].options);
    // }

    // Add progress field
    if (params.progress.enabled) {
      $progress = $('<div class="progress"></div>');
      $boardgame.append($progress);
      $progress.css({
        left: params.progress.coords.x + 'px',
        top: params.progress.coords.y + 'px'
      });
      _updateProgress();
    }

    return this;
  };

  // Masquerade the main object to hide inner properties and functions.
  var returnObject = {
    attach: attach, // Attach to DOM object
    endGame: _displayEndGame,
    defaults: defaults // Provide defaults for inspection
  };
  return returnObject;
};