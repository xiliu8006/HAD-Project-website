window.HELP_IMPROVE_VIDEOJS = false;

var INTERP_BASE = "./static/interpolation/stacked";
var NUM_INTERP_FRAMES = 240;

var interp_images = [];
function preloadInterpolationImages() {
  for (var i = 0; i < NUM_INTERP_FRAMES; i++) {
    var path = INTERP_BASE + '/' + String(i).padStart(6, '0') + '.jpg';
    interp_images[i] = new Image();
    interp_images[i].src = path;
  }
}

function setInterpolationImage(i) {
  var image = interp_images[i];
  image.ondragstart = function() { return false; };
  image.oncontextmenu = function() { return false; };

  var wrapper = document.getElementById('interpolation-image-wrapper');
  if (wrapper) {
    wrapper.innerHTML = '';
    wrapper.appendChild(image);
  }
}

function initializeVideoComparisons() {
  document.querySelectorAll('[data-video-compare]').forEach(function(compare) {
    if (compare.dataset.initialized === 'true') {
      return;
    }

    var range = compare.querySelector('.video-compare__range');
    var beforeVideo = compare.querySelector('.video-compare__before');
    var afterVideo = compare.querySelector('.video-compare__after');

    if (!range || !beforeVideo || !afterVideo) {
      return;
    }

    compare.dataset.initialized = 'true';

    function setComparisonValue(value) {
      value = Math.max(0, Math.min(100, Number(value || 50)));
      range.value = value;
      compare.style.setProperty('--compare-position', value + '%');
    }

    function updateComparison() {
      setComparisonValue(range.value);
    }

    function updateComparisonFromPointer(event) {
      var rect = compare.getBoundingClientRect();
      if (!rect.width) {
        return;
      }

      var value = ((event.clientX - rect.left) / rect.width) * 100;
      setComparisonValue(value);
    }

    function stopEvent(event) {
      if (event.preventDefault) {
        event.preventDefault();
      }

      if (event.stopPropagation) {
        event.stopPropagation();
      }
    }

    var isDragging = false;

    function startDrag(event) {
      isDragging = true;
      stopEvent(event);

      if (event.pointerId !== undefined && compare.setPointerCapture) {
        compare.setPointerCapture(event.pointerId);
      }

      updateComparisonFromPointer(event);
    }

    function drag(event) {
      if (!isDragging && event.buttons !== 1) {
        return;
      }

      stopEvent(event);
      updateComparisonFromPointer(event);
    }

    function stopDrag(event) {
      isDragging = false;

      if (event && event.stopPropagation) {
        event.stopPropagation();
      }
    }

    compare.addEventListener('pointerdown', startDrag, true);
    compare.addEventListener('pointermove', drag, true);
    compare.addEventListener('pointerup', stopDrag, true);
    compare.addEventListener('pointercancel', stopDrag, true);

    compare.addEventListener('mousedown', startDrag, true);
    compare.addEventListener('mousemove', drag, true);
    document.addEventListener('mouseup', stopDrag);

    compare.addEventListener('touchstart', function(event) {
      if (event.touches.length > 0) {
        stopEvent(event);
        startDrag(event.touches[0]);
      }
    }, { capture: true, passive: false });

    compare.addEventListener('touchmove', function(event) {
      if (event.touches.length > 0) {
        stopEvent(event);
        updateComparisonFromPointer(event.touches[0]);
      }
    }, { capture: true, passive: false });
    document.addEventListener('touchend', stopDrag);
    document.addEventListener('touchcancel', stopDrag);

    function syncTime(source, target) {
      if (!Number.isFinite(source.currentTime) || !Number.isFinite(target.currentTime)) {
        return;
      }

      if (Math.abs(source.currentTime - target.currentTime) > 0.08) {
        target.currentTime = source.currentTime;
      }
    }

    function syncPlayback(source, target) {
      syncTime(source, target);
      target.playbackRate = source.playbackRate;

      if (source.paused && !target.paused) {
        target.pause();
      } else if (!source.paused && target.paused) {
        target.play().catch(function() {});
      }
    }

    [beforeVideo, afterVideo].forEach(function(video) {
      video.addEventListener('play', function() {
        syncPlayback(video, video === beforeVideo ? afterVideo : beforeVideo);
      });

      video.addEventListener('pause', function() {
        if (!video.ended) {
          (video === beforeVideo ? afterVideo : beforeVideo).pause();
        }
      });

      video.addEventListener('seeking', function() {
        syncTime(video, video === beforeVideo ? afterVideo : beforeVideo);
      });

      video.addEventListener('timeupdate', function() {
        syncTime(video, video === beforeVideo ? afterVideo : beforeVideo);
      });
    });

    range.addEventListener('input', updateComparison);
    window.addEventListener('resize', updateComparison);

    if ('ResizeObserver' in window) {
      new ResizeObserver(updateComparison).observe(compare);
    }

    updateComparison();
    setTimeout(updateComparison, 250);
    setTimeout(updateComparison, 1000);

    afterVideo.addEventListener('loadedmetadata', function() {
      syncPlayback(beforeVideo, afterVideo);
      updateComparison();
    });
  });
}

function initializeAutoplayVideos(root) {
  var scope = root || document;
  scope.querySelectorAll('video[autoplay]').forEach(function(video) {
    video.muted = true;
    video.defaultMuted = true;
    video.loop = true;
    video.playsInline = true;

    var playAttempt = video.play();
    if (playAttempt && typeof playAttempt.catch === 'function') {
      playAttempt.catch(function() {});
    }
  });
}

function syncCarouselPair(primaryId, secondaryId) {
  var primaryElement = document.getElementById(primaryId);
  var secondaryElement = document.getElementById(secondaryId);

  if (!primaryElement || !secondaryElement || !primaryElement.bulmaCarousel || !secondaryElement.bulmaCarousel) {
    return;
  }

  var primaryCarousel = primaryElement.bulmaCarousel;
  var secondaryCarousel = secondaryElement.bulmaCarousel;
  var isSyncing = false;

  function moveTo(carousel, targetIndex) {
    var currentIndex = carousel.state.current || 0;
    var steps = targetIndex - currentIndex;
    var method = steps > 0 ? 'next' : 'previous';

    for (var i = 0; i < Math.abs(steps); i++) {
      carousel[method]();
    }
  }

  function sync(sourceCarousel, targetCarousel, state) {
    if (isSyncing) {
      return;
    }

    isSyncing = true;
    moveTo(targetCarousel, state.next);
    setTimeout(function() {
      isSyncing = false;
    }, 120);
  }

  primaryCarousel.on('before:show', function(state) {
    sync(primaryCarousel, secondaryCarousel, state);
  });

  secondaryCarousel.on('before:show', function(state) {
    sync(secondaryCarousel, primaryCarousel, state);
  });
}

function initializeCarousels() {
  if (typeof bulmaCarousel === 'undefined') {
    return;
  }

  var options = {
    slidesToScroll: 1,
    slidesToShow: 1,
    loop: true,
    infinite: true,
    autoplay: false,
    autoplaySpeed: 3000
  };

  bulmaCarousel.attach('.carousel', options);

  syncCarouselPair('results-carousel-dl3dv', 'image-carousel-dl3dv');
  syncCarouselPair('results-carousel-mipnerf360', 'image-carousel-mipnerf360');
  document.querySelectorAll('.carousel').forEach(function(element) {
    if (element.bulmaCarousel) {
      element.bulmaCarousel.on('after:show', function() {
        initializeAutoplayVideos(element);
      });
      element.bulmaCarousel.on('before:show', function() {
        initializeAutoplayVideos(element);
      });
    }
  });
}

function initializeInterpolation() {
  var slider = document.getElementById('interpolation-slider');
  var wrapper = document.getElementById('interpolation-image-wrapper');

  if (!slider || !wrapper) {
    return;
  }

  preloadInterpolationImages();

  slider.addEventListener('input', function() {
    setInterpolationImage(this.value);
  });
  slider.max = NUM_INTERP_FRAMES - 1;
  setInterpolationImage(0);
}

document.addEventListener('DOMContentLoaded', function() {
    // Check for click events on the navbar burger icon
    document.querySelectorAll('.navbar-burger').forEach(function(burger) {
      burger.addEventListener('click', function() {
        // Toggle the "is-active" class on both the "navbar-burger" and the "navbar-menu"
        document.querySelectorAll('.navbar-burger').forEach(function(element) {
          element.classList.toggle('is-active');
        });
        document.querySelectorAll('.navbar-menu').forEach(function(element) {
          element.classList.toggle('is-active');
        });
      });
    });

    initializeCarousels();

    initializeInterpolation();

    if (typeof bulmaSlider !== 'undefined') {
      bulmaSlider.attach();
    }
    initializeVideoComparisons();
    setTimeout(initializeVideoComparisons, 800);
    setTimeout(initializeVideoComparisons, 1500);
    initializeAutoplayVideos();
    setTimeout(initializeAutoplayVideos, 800);
    setTimeout(initializeAutoplayVideos, 1500);

});
