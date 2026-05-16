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
    beforeVideo.muted = true;
    afterVideo.muted = true;
    beforeVideo.defaultMuted = true;
    afterVideo.defaultMuted = true;
    beforeVideo.loop = true;
    afterVideo.loop = true;
    beforeVideo.playsInline = true;
    afterVideo.playsInline = true;
    beforeVideo.preload = 'metadata';
    afterVideo.preload = 'metadata';
    [beforeVideo, afterVideo].forEach(function(video) {
      var source = video.querySelector('source');
      if (source && source.getAttribute('src')) {
        video.poster = source.getAttribute('src')
          .replace('./static/videos/', './static/videos_posters/')
          .replace(/\.mp4(?:\?.*)?$/, '.jpg');
      }
    });

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

    var loadRequested = false;

    function videosCanPlay() {
      return beforeVideo.readyState >= 2 && afterVideo.readyState >= 2;
    }

    function ensureVideosLoad() {
      beforeVideo.preload = 'auto';
      afterVideo.preload = 'auto';

      if (loadRequested) {
        return;
      }

      loadRequested = true;
      beforeVideo.load();
      afterVideo.load();
    }

    function alignTime(source, target, threshold) {
      if (!Number.isFinite(source.currentTime) || !Number.isFinite(target.currentTime)) {
        return;
      }

      if (Math.abs(source.currentTime - target.currentTime) > threshold) {
        target.currentTime = source.currentTime;
      }
    }

    function setPlaybackRate(rate) {
      beforeVideo.playbackRate = rate;
      afterVideo.playbackRate = rate;
    }

    function pauseBoth() {
      beforeVideo.pause();
      afterVideo.pause();
    }

    function playBoth() {
      if (!compare.dataset.shouldPlay || compare.dataset.shouldPlay !== 'true') {
        return;
      }

      if (!videosCanPlay()) {
        ensureVideosLoad();
        return;
      }

      setPlaybackRate(1);
      alignTime(beforeVideo, afterVideo, 0);

      var beforePlay = beforeVideo.play();
      var afterPlay = afterVideo.play();

      if (beforePlay && typeof beforePlay.catch === 'function') {
        beforePlay.catch(function() {});
      }
      if (afterPlay && typeof afterPlay.catch === 'function') {
        afterPlay.catch(function() {});
      }
    }

    function restartBoth() {
      beforeVideo.currentTime = 0;
      afterVideo.currentTime = 0;
      playBoth();
    }

    function requestPlay() {
      compare.dataset.shouldPlay = 'true';
      ensureVideosLoad();
      playBoth();
    }

    function requestPause() {
      compare.dataset.shouldPlay = 'false';
      pauseBoth();
      loadRequested = false;
      beforeVideo.preload = 'metadata';
      afterVideo.preload = 'metadata';
    }

    function keepInSync() {
      if (compare.dataset.shouldPlay !== 'true') {
        return;
      }

      if (beforeVideo.paused || afterVideo.paused) {
        playBoth();
      }

      alignTime(beforeVideo, afterVideo, 0.04);
    }

    [beforeVideo, afterVideo].forEach(function(video) {
      video.addEventListener('pause', function() {
        if (compare.dataset.shouldPlay === 'true' && !video.ended) {
          playBoth();
        }
      });

      video.addEventListener('seeking', function() {
        alignTime(video, video === beforeVideo ? afterVideo : beforeVideo, 0);
      });

      video.addEventListener('waiting', function() {
        if (compare.dataset.shouldPlay === 'true') {
          pauseBoth();
        }
      });
      video.addEventListener('canplay', playBoth);
      video.addEventListener('loadeddata', playBoth);
      video.addEventListener('loadedmetadata', playBoth);
      video.addEventListener('ended', restartBoth);
    });

    var syncInterval = window.setInterval(keepInSync, 120);

    if ('requestVideoFrameCallback' in beforeVideo) {
      var syncOnFrame = function() {
        keepInSync();
        beforeVideo.requestVideoFrameCallback(syncOnFrame);
      };
      beforeVideo.requestVideoFrameCallback(syncOnFrame);
    }

    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            requestPlay();
          } else {
            requestPause();
          }
        });
      }, { threshold: [0, 0.35] });

      observer.observe(compare);
    } else {
      requestPlay();
    }

    compare.__videoCompareSync = {
      play: requestPlay,
      pause: requestPause,
      sync: keepInSync,
      destroy: function() {
        window.clearInterval(syncInterval);
      }
    };

    compare.addEventListener('mouseenter', keepInSync);
    compare.addEventListener('pointerdown', keepInSync);

    document.addEventListener('visibilitychange', function() {
      if (document.hidden) {
        requestPause();
      } else {
        keepInSync();
      }
    });

    beforeVideo.addEventListener('loadedmetadata', function() {
      if (afterVideo.readyState >= 1) {
        afterVideo.currentTime = beforeVideo.currentTime;
      }
    });

    afterVideo.addEventListener('loadedmetadata', function() {
      afterVideo.currentTime = beforeVideo.currentTime || 0;
      playBoth();
    });

    range.addEventListener('input', updateComparison);
    window.addEventListener('resize', updateComparison);

    if ('ResizeObserver' in window) {
      new ResizeObserver(updateComparison).observe(compare);
    }

    updateComparison();
    setTimeout(updateComparison, 250);
    setTimeout(updateComparison, 1000);
  });
}

function isElementInViewport(element) {
  var rect = element.getBoundingClientRect();
  return rect.width > 0 &&
    rect.height > 0 &&
    rect.bottom > 0 &&
    rect.right > 0 &&
    rect.top < (window.innerHeight || document.documentElement.clientHeight) &&
    rect.left < (window.innerWidth || document.documentElement.clientWidth);
}

function updateVisibleVideoComparisons(root) {
  var scope = root || document;
  scope.querySelectorAll('[data-video-compare]').forEach(function(compare) {
    if (!compare.__videoCompareSync) {
      return;
    }

    if (isElementInViewport(compare)) {
      compare.__videoCompareSync.play();
      compare.__videoCompareSync.sync();
    } else {
      compare.__videoCompareSync.pause();
    }
  });
}

function normalizeCarouselIndex(carousel, index) {
  var length = carousel && carousel.state ? carousel.state.length : 0;
  if (!length) {
    return 0;
  }

  return ((Number(index) % length) + length) % length;
}

function moveCarouselTo(carousel, targetIndex) {
  if (!carousel || !carousel.state) {
    return;
  }

  targetIndex = normalizeCarouselIndex(carousel, targetIndex);
  carousel.state.next = targetIndex;

  if (typeof carousel.show === 'function') {
    carousel.show(undefined, true);
  }

  if (carousel.state.index !== targetIndex) {
    carousel.state.index = targetIndex;
  }

  if (carousel.slides) {
    carousel.slides.forEach(function(slide) {
      var slideIndex = Number(slide.dataset.sliderIndex || 0);
      slide.classList.toggle('is-current', slideIndex === targetIndex);
      slide.classList.toggle('is-active', slideIndex === targetIndex);
      slide.classList.toggle('is-slide-previous', slideIndex === normalizeCarouselIndex(carousel, targetIndex - 1));
      slide.classList.toggle('is-slide-next', slideIndex === normalizeCarouselIndex(carousel, targetIndex + 1));
    });
  }

  if (carousel.container && carousel.slides) {
    var targetSlide = carousel.slides.find(function(slide) {
      return Number(slide.dataset.sliderIndex || 0) === targetIndex;
    });

    if (!targetSlide) {
      return;
    }

    carousel.container.style.transition = 'none';
    carousel.container.style.transform = 'translate3d(-' + targetSlide.offsetLeft + 'px, 0, 0)';
  }
}

function getCarouselIndex(carousel) {
  if (!carousel || !carousel.state) {
    return 0;
  }

  return normalizeCarouselIndex(carousel, carousel.state.next);
}

function moveCarouselElementTo(carouselElement, targetIndex) {
  var container = carouselElement.querySelector('.slider-container');
  var slides = Array.prototype.slice.call(carouselElement.querySelectorAll('.slider-item'));
  var targetSlide = slides.find(function(slide) {
    return Number(slide.dataset.sliderIndex || 0) === targetIndex;
  });

  if (!container || !slides.length || !targetSlide) {
    return;
  }

  slides.forEach(function(slide) {
    var slideIndex = Number(slide.dataset.sliderIndex || 0);
    slide.classList.toggle('is-current', slideIndex === targetIndex);
    slide.classList.toggle('is-active', slideIndex === targetIndex);
    slide.classList.toggle('is-slide-previous', slideIndex === targetIndex - 1);
    slide.classList.toggle('is-slide-next', slideIndex === targetIndex + 1);
  });

  container.style.transition = 'none';
  container.style.transform = 'translate3d(-' + targetSlide.offsetLeft + 'px, 0, 0)';
}

function initializeVideoThumbnails() {
  document.querySelectorAll('.comparison-video-frame').forEach(function(carouselElement) {
    var carousel = carouselElement.bulmaCarousel;
    var thumbnailBar = document.querySelector('[data-carousel-thumbs-for="' + carouselElement.id + '"]');

    if (!carousel || !thumbnailBar || carouselElement.dataset.thumbnailsInitialized === 'true') {
      return;
    }

    function updateActiveThumbnail() {
      var activeIndex = getCarouselIndex(carousel);
      thumbnailBar.querySelectorAll('.video-carousel-thumb').forEach(function(button) {
        button.classList.toggle('is-active', Number(button.dataset.index) === activeIndex);
      });
    }

    carouselElement.dataset.thumbnailsInitialized = 'true';
    updateActiveThumbnail();

    carousel.on('after:show', function() {
      updateActiveThumbnail();
    });
    carousel.on('before:show', function() {
      setTimeout(updateActiveThumbnail, 0);
    });
  });
}

var lastThumbnailPointerTime = 0;

function handleVideoThumbnailEvent(event) {
  if (event.type === 'click' && Date.now() - lastThumbnailPointerTime < 400) {
    return;
  }

  var button = event.target.closest('.video-carousel-thumb');
  if (!button) {
    return;
  }

  if (event.type === 'pointerdown') {
    lastThumbnailPointerTime = Date.now();
  }

  var thumbnailBar = button.closest('[data-carousel-thumbs-for]');
  if (!thumbnailBar) {
    return;
  }

  var carouselElement = document.getElementById(thumbnailBar.dataset.carouselThumbsFor);
  var carousel = carouselElement ? carouselElement.bulmaCarousel : null;
  if (!carouselElement) {
    return;
  }

  event.preventDefault();
  if (event.stopPropagation) {
    event.stopPropagation();
  }

  var targetIndex = Number(button.dataset.index || 0);
  if (carousel) {
    moveCarouselTo(carousel, targetIndex);
  } else {
    moveCarouselElementTo(carouselElement, targetIndex);
  }

  thumbnailBar.querySelectorAll('.video-carousel-thumb').forEach(function(item) {
    item.classList.toggle('is-active', item === button);
  });

  setTimeout(function() {
    updateVisibleVideoComparisons(carouselElement);
  }, 80);
}

document.addEventListener('pointerdown', handleVideoThumbnailEvent, true);
document.addEventListener('click', handleVideoThumbnailEvent, true);

function syncCarouselPair(primaryId, secondaryId) {
  var primaryElement = document.getElementById(primaryId);
  var secondaryElement = document.getElementById(secondaryId);

  if (!primaryElement || !secondaryElement || !primaryElement.bulmaCarousel || !secondaryElement.bulmaCarousel) {
    return;
  }

  var primaryCarousel = primaryElement.bulmaCarousel;
  var secondaryCarousel = secondaryElement.bulmaCarousel;
  var isSyncing = false;

  function sync(sourceCarousel, targetCarousel, state) {
    if (isSyncing) {
      return;
    }

    isSyncing = true;
    moveCarouselTo(targetCarousel, state.next);
    setTimeout(function() {
      isSyncing = false;
      updateVisibleVideoComparisons();
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
    infinite: false,
    autoplay: false,
    autoplaySpeed: 3000
  };

  bulmaCarousel.attach('.carousel', options);
  initializeVideoThumbnails();

  syncCarouselPair('results-carousel-dl3dv', 'image-carousel-dl3dv');
  syncCarouselPair('results-carousel-mipnerf360', 'image-carousel-mipnerf360');
  document.querySelectorAll('.carousel').forEach(function(element) {
    if (element.bulmaCarousel) {
      element.bulmaCarousel.on('after:show', function() {
        updateVisibleVideoComparisons(element);
        initializeVideoThumbnails();
      });
      element.bulmaCarousel.on('before:show', function() {
        updateVisibleVideoComparisons(element);
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
    updateVisibleVideoComparisons();
    setTimeout(initializeVideoComparisons, 800);
    setTimeout(initializeVideoComparisons, 1500);
    setTimeout(updateVisibleVideoComparisons, 200);
    setTimeout(updateVisibleVideoComparisons, 800);
    setTimeout(updateVisibleVideoComparisons, 1500);

});

window.addEventListener('load', function() {
  initializeVideoComparisons();
  updateVisibleVideoComparisons();
});

window.addEventListener('pageshow', function() {
  initializeVideoComparisons();
  updateVisibleVideoComparisons();
});
