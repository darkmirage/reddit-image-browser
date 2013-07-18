// General fetch for most Reddit objects
function fetcher(args, callback) {
  var url = 'http://www.reddit.com';
  if (args === undefined) {
    url += '/api/info';
  } else if (args.type !== undefined) {
    url += '/' + args.type;
    if (args.name !== undefined) {
      url += '/' + args.name;
    }
  }
  url += '.json';

  var params = [];
  if (args !== undefined) {
    if (args.limit !== undefined)
      params.push('limit=' + args.limit);
    if (args.after !== undefined)
      params.push('after=' + args.after);
    params = params.join('&');
  }

  var full_url = params.length > 0 ? url + '?' + params : url;

  console.log('Request: ' + full_url);

  $.ajax({
    type: 'GET',
    data: params,
    dataType: 'jsonp',
    url: url,
    jsonp: 'jsonp',
    success: function(reponse) {
      console.log('Fetched: ' + full_url);
      console.log(reponse);
      callback(reponse, full_url);
    },
    error: function (xhr, ajaxOptions, thrownError) {
      console.log(thrownError);
      console.log('Retrying...');
      setTimeout(function() {
        fetcher(args, callback);
      }, 600);
    }
  });
}

// Might use this someday...
var params = {};
function readParams() {
  var query = window.location.search;
  if (query.length == 0)
    return;
  if (query[0] == '?') query = query.substr(1);
  var list = query.split('&');
  for (var i = 0; i < list.length; i++) {
    var pair = list[i].split('=');
    params[pair[0]] = pair[1];
  }

  console.log('Parameters parsed');
  console.log(params);
}

// Cookieeeees. But really HTML5 storage.
var cookies = {
  supports_html5_storage: function() {
    try {
      return 'localStorage' in window && window['localStorage'] !== null && window['localStorage'] !== undefined;
    } catch (e) {
      return false;
    }
  },
  get: function(name) {
    if (cookies.supports_html5_storage()) {
      var val = localStorage.getItem(name);
      return val ? localStorage.getItem(name).split('|') : false;
    }
    return false;
  },
  set: function(name, value) {
    if (cookies.supports_html5_storage()) {
      localStorage[name] = value.join('|');
      return true;
    }
    return false;
  }
}

// Underscore.js templates
var templates = {};
function loadTemplates() {
  var ids = ['link', 'self', 'subreddit', 'meta', 'user'];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    templates[id] = _.template($('#template-' + id).html());
  }
  console.log('Templates loaded');
}

// Main RIB class
function RedditImageBrowser(config) {
  console.log('Initializing RIB');
  var rib = this; // Humor me
  rib.subreddits = [];

  // Configurations
  rib.config = {};
  rib.config.cage_id = '#ribcage';
  rib.config.sub_id = '#subreddits';
  rib.config.defaults = ['aww', 'pics', 'gifs', 'EarthPorn'];
  rib.config.hover_scroll = false;
  rib.config.scroll_width = 860;

  // Configuration parser
  rib.set = function(config) {
    if (config !== undefined) {
      for (var key in config) {
        rib.config[key] = config[key];
      }
    }
    rib.cage = $(rib.config.cage_id);
    rib.subview = $(rib.config.sub_id)

    var subs = cookies.get('subreddits');
    if (subs) rib.config.defaults = subs;
    else rib.config.first = true;
  }

  // Parse configurations
  rib.set(config);

  // Implments fetching in this module
  rib.fetch = function(args, callback) {
    if (callback === undefined)
      callback = rib.parse;
    fetcher(args, callback);
  }

  rib.add = function(name) {
    $('a[data-name=' + name + ']').addClass('active');
    rib.main.add(name);
  }

  rib.remove = function(name) {
    $('a[data-name=' + name + ']').removeClass('active');
    rib.main.remove(name);
  }

  rib.enableSubreddits = function(elem) {
    if (elem === undefined)
      elem = rib.subview;
    elem.find('a').on('click', function() {
    if ($(this).hasClass('active'))
      rib.remove($(this).attr('data-name'));
    else
      rib.add($(this).attr('data-name'));
    });
  }

  rib.displaySubreddit = function(json) {
    var elem = $(templates.subreddit({ item: json.data }));
    $(rib.config.sub_id).append(elem);
    rib.enableSubreddits(elem);
    elem.hide();
    elem.fadeIn(500);
  }

  rib.addSubreddits = function(json) {
    var list = json.data.children;
    for (var i = 0; i < list.length; i++) {
      rib.addSubreddit(list[i]);
    }
  }

  rib.addSubreddit = function(json) {
    if (_.indexOf(rib.subreddits, json.data.display_name) == -1) {
      rib.subreddits.push(json.data.display_name);
      rib.displaySubreddit(json);
    }
  }

  rib.displayHot = function() {
    rib.fetch({ type: 'subreddits', name: 'popular' }, function(json) {
      rib.addSubreddits(json);
    });
  }

  rib.fetchSubreddit = function(name, callback) {
      rib.fetch({ type: 'r', name: name + '/about' }, function(json) {
        rib.addSubreddit(json);
        rib.add(json.data.display_name);
        if (callback !== undefined)
          callback(json);
      });
  }

  rib.initSubreddits = function() {
    var form = $('#subreddits-add').hide();
    var input = form.find('input');
    var add = $('#subreddits-controls .add');
    input
      .focus(function() { input.val(''); })
      .blur(function() { form.hide(); add.show(); })
      .keypress(function(e) {
        if (e.which == 13) {
          e.preventDefault();
          rib.fetchSubreddit(input.val());
          input.val('');
          input.blur();
        }
      });

    add.click(function(e) {
        add.hide();
        form.show();
        input.focus();
        e.preventDefault();
      })

    var subs = rib.config.defaults;
    var remain = subs.length;
    if (remain == 0) {
      rib.displayHot();
      return;
    }

    for (var i = 0; i < subs.length; i++) {
      rib.fetchSubreddit(subs[i], function() {
        remain--;
        if (remain == 0) {
          rib.displayHot();
        }
      });
    }
  }

  rib.enableHandles = function() {
    var toggleSub = false;
    var toggleFAQ = false;
    var subParent = rib.subview.parent();
    var faqView = $('#faq');

    var enableSub = function(handle) {
      var show = function() {
        subParent.stop(true, false).animate({'right': '-10px'}, 500);
        handle.addClass('active');
        toggleSub = true;
        $('#dark').stop(true, false).fadeIn(500);
      };
      var hide = function() {
        subParent.animate({'right': '-310px'}, 500);
        handle.removeClass('active');
        toggleSub = false;
        $('#dark').fadeOut(500);
      };

      handle.click(function(e) {
        if (!toggleSub && !toggleFAQ) show();
        else hide();
        e.preventDefault();
      });

      rib.subview.parent().find('.close').hide().on('click', hide);
    }

    var enableGuide = function(handle) {
      var guide = $('#guide');
      handle.hover(function() {
        handle.addClass('hover');
        if (toggleFAQ) return;
        var left = ($(window).width() - guide.width()) / 2;
        guide.css('left', left + 'px');
        guide.fadeIn(0);
        $('#dark').stop(true, false).fadeIn(300);
      }, function() {
        handle.removeClass('hover');
        if (toggleFAQ) return;
        guide.fadeOut(300);
        $('#dark').fadeOut(0);
      }).click(function(e) { e.preventDefault(); });
    }

    var enableFAQ = function(handle) {
      var show = function() {
        faqView.show();
        handle.addClass('active');
        toggleFAQ = true;
        $('#dark').stop(true, false).fadeIn(500);
      };
      var hide = function() {
        faqView.hide();
        handle.removeClass('active');
        toggleFAQ = false;
        $('#dark').fadeOut(500);
      };

      handle.click(function(e) {
        if (!toggleFAQ)
          show();
        else
          hide();
        e.preventDefault();
      });
    }

    enableSub($('a[data-name=subreddits]'));
    enableGuide($('a[data-name=guide]'));
    enableFAQ($('a[data-name=faq]'));

    /* Trigger their respective buttons to close overlays. Kind of dumb but
       it works since I neglected to write externally-accessible functions
       for closing the popups... */
    var hideAll = function() {
      if (toggleFAQ)
        $('a[data-name=faq]').trigger('click');
      if (toggleSub)
        $('a[data-name=subreddits]').trigger('click');
    }
    $('#dark, .page').click(hideAll);
    $(document).on('keydown', function(e) {
      if (e.which == 27) hideAll();
    });
    $('#faq .page-content').click(function(e) { e.stopPropagation(); });
  }

  rib.init = function() {
    // Initialize main view
    rib.main = new MainView(rib.config);

    rib.enableHandles();

    // Kind of bruteforce way of avoiding ugly text selections
    rib.cage.bind('selectstart dragstart', function(e) {
      e.preventDefault();
      return false;
    });

    rib.initSubreddits();

    if (rib.config.first) {
      $('#first').show();
      $(document).keypress(function() { $('#first').hide(); });
    }
  }
}

// Item parsing and rendering for the main links
function MainView(config) {
  var that = this;

  this.subs = config.defaults.slice(0);
  this.links = [];
  var after = null;
  var limit = 30;

  var container = $('#links');
  var content = d3.select('#links');
  var curr = $('#post');
  var meta = $('#post-meta');

  var scrolling = false;
  var loading = false;
  var selected = null;
  var simple = null;

  // These operate on the Subreddit list
  this.remove = function(entry) {
    var i = _.indexOf(that.subs, entry);
    while (i != -1) {
      that.subs.splice(i, 1);
      i = _.indexOf(that.subs, entry);
    }
    that.reset();
  }

  this.add = function(entry) {
    if (_.indexOf(that.subs, entry) != -1)
      return;
    that.subs.push(entry);
    limit += 10;
    that.reset();
    cookies.set('subreddits', that.subs);
  }

  // These operate on the retrieved links
  this.parse = function(json, url) {
    that.links = that.links.concat(json.data.children);
    after = that.links[that.links.length - 1].data.name;
    that.format();
    that.render();
    loading = false;
    that.helpers.hideLoading();
  }

  this.more = function(callback) {
    if (loading)
      return false;
    loading = true;
    that.helpers.showLoading();

    args = {};
    if (that.subs.length == 0) {
      args.type = 'hot';
    } else {
      var name = that.subs.join('+');
      args.type = 'r';
      args.name = name;
    }

    if (after != null)
      args.after = after;

    that.fetch(args, function(json, url) {
      that.parse(json, url);
      if (callback !== undefined)
        callback(json);
    });
    return true;
  }

  this.reset = function(callback) {
    cookies.set('subreddits', that.subs);
    that.links = [];
    after = null;
    limit = 30;
    that.helpers.scrollHome();

    var succuess = that.more(function(json) {
      that.select(0);
      if (callback !== undefined)
        callback(json);
    });

    if (!succuess) {
      setTimeout(function() {
        that.reset(callback);
      }, 100);
    }
  }

  // Display the selected item
  this.display = function(link) {
    var content = $('<div></div>').addClass('shadow');

    if (link.type == 'image') {
      var elem = link.img;
      elem.addClass('post-content');
    }
    else if (link.type == 'album') {
      var elem = $('<iframe></iframe>');
      elem
        .addClass('post-content')
        .attr('frameborder', 0)
        .attr('src', link.data.url + '/embed');
      link.iframe = elem;
    }
    else if (link.type == 'video') {
      var elem = link.video;
    }
    else { //if (link.type == 'self' || link.type == 'page') {
      var elem = $('<div></div>');
      elem
        .addClass('self-post')
        .html(templates.self({ item: link.data }));
    }

    curr.html('');
    content.attr('id', link.data.name);
    content.append(elem);

    // if (link.type == 'album')
    //   content.append('<div class="imgur-note">You can browse Imgur albums with your arrow keys</div>')

    meta.html(templates.meta({ item: link.data }));

    curr.append(content);
    this.resize(false);
  }

  // Basic rendering of thumbnails with no paging
  this.render = function() {
    var update = content.selectAll('span')
      .data(that.links, function(d) { return d.data.name; });

    update
      .attr('data-index', function(d, i) { return i; })
      .style('left', function(d, i) { return (5 + i * 75) + 'px' });

    update.exit()
      .call(that.helpers.hide);

    update.enter()
      .append('span')
      .style('left', function(d, i) { return (5 + i * 75) + 'px' })
      .html(function(d) { return templates.link({ item: d.data }); })
      .attr('class', 'thumbnail')
      .attr('data-name', function(d, i) { return d.data.name; })
      .attr('data-index', function(d, i) { return i; })
      .call(that.helpers.show);

    that.helpers.enableLinks();
  }

  this.select = function(index) {
    container.find('.thumbnail').removeClass('selected');
    var elem = $('span[data-index=' + index + ']');
    elem.addClass('selected');
    selected = elem;
    that.display(that.links[index]);
    that.helpers.scrollCheck();
  }

  this.selected = function() {
    return that.links[selected.attr('data-index')];
  }

  this.format = function() {
    that.links = _.compact(that.links);
    for (var i = 0; i < that.links.length; i++) {
      var link = that.links[i];
      var d = link.data;
      var type = d.url.substr(d.url.length - 3, 3);

      if (_.indexOf(['png', 'jpg', 'gif'], type) != -1) {
        link.type = 'image';
      }
      else if (d.url.indexOf('imgur.com/a/') != -1) {
        link.type = 'album';
      }
      else if (d.url.indexOf('imgur.com/gallery/') != -1) {
        d.url = d.url.replace(/\/new$/, '');
        d.url = d.url.replace('imgur.com/gallery/', 'imgur.com/') + '.jpg';
        link.type = 'image';
      }
      else if (d.url.indexOf('imgur.com') != -1) {
        d.url += '.jpg';
        link.type = 'image';
      }

      if (d.thumbnail == 'self' || d.is_self) {
        d.thumbnail = './img/self.png';
        link.type = 'self';
      }
      else if (d.thumbnail == '' || d.thumbnail == 'default') {
        if (link.type == 'image')
          d.thumbnail = './img/img.png';
        else
          d.thumbnail = './img/nothumb.png';
      }
      else if (d.thumbnail == 'nsfw') {
        d.thumbnail = './img/nsfw.png';
      }

      if (d.media != null) {
        that.helpers.processVideo(link);
        link.type = 'video';
      }

      if (link.type === undefined) {
        link.type = 'page';
      }

      // preload images
      that.helpers.preload(link);
    }
  }

  var resizeTimer;
  this.resize = function(animate) {
    var doResize = function() {
      var curr = $('#post .post-content');
      var height = 0;

      if (!simple) {
        height += $('#header').height();
        height += $('#links').height();
      }
      // height += $('#footer').height();
      height += $('#post-meta').height();
      // Kind of hacky since I'm accounting for margins manually
      height = $(window).height() - height - 80;

      var params = { 'max-height': height + 'px'};

      ratio = selected.attr('data-ratio');

      if (that.selected().ratio > 0)
        params['max-width'] = that.selected().ratio * height;

      // curr.css('max-height', curr.height() + 'px');
      curr.stop();
      if (animate)
        curr.animate(params, 500);
      else
        curr.css(params);
    }

    if (animate) {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(doResize, 200);
    } else {
      doResize();
    }
  }

  // Helper functions
  this.helpers = {
    loadCounts: { bar: 0 },
    showLoading: function(type, count) {
      if (type === undefined)
        type = 'bar';
      if (count === undefined)
        count = 1;
      that.helpers.loadCounts[type] += count;
      $('#loading').fadeIn(200);
    },
    hideLoading: function(type) {
      if (type === undefined)
        type = 'bar';
      that.helpers.loadCounts[type] -= 1;
      if (that.helpers.loadCounts[type] < 1)
        $('#loading').fadeOut(500);
    },
    scrollHome: function() {
      container.scrollLeft(0);
      $('#scroll-left').hide();
    },
    scroll: function(rate, i) {
      if (i === undefined)
        i = 0;

      if (!scrolling && i >= 0 || rate == 0)
        return;

      var prev = container.scrollLeft();
      var target = prev + rate;

      // Scroll animation
      var duration = i >= 0 ? 0 : 400;
      container.stop();
      container.animate({ scrollLeft: target }, duration, function() {
        var last_index = that.links.length - 1;
        var last = $('span[data-index=' + last_index + ']');
        var right_edge = parseInt(last.css('left'), 10) + last.width() + 10;
        if (container.scrollLeft() + 2 * config.scroll_width > right_edge && !loading) {
          that.more();
        }

        if (container.scrollLeft() == 0) {
          $('#scroll-left').hide();
        } else {
          $('#scroll-left').show();
        }
      });

      // Set i to negative for a one-off scroll job!
      if (i < 0)
        return;
      // Continuously scroll otherwise
      setTimeout(function() {
        that.helpers.scroll(rate, i + 1);
      }, 10);
    },
    scrollTo: function(target) {
      var curr = container.scrollLeft();
      var step = target - curr;
      that.helpers.scroll(step, -1);
    },
    scrollNextPage: function() {
      that.helpers.scroll(config.scroll_width - 100, -1);
    },
    scrollPrevPage: function() {
      that.helpers.scroll(-(config.scroll_width - 100), -1);
    },
    scrollCheck: function(target) {
      var pos = parseInt(selected.css('left'), 10)
      var scroll_pos = container.scrollLeft();
      if (pos + selected.width() >= scroll_pos + config.scroll_width) {
        that.helpers.scrollTo(pos - 5);
        return;
      }

      if (pos < scroll_pos)
        that.helpers.scrollTo(pos + selected.width() + 10 - config.scroll_width);
    },
    selectNext: function() {
      var index = parseInt(selected.attr('data-index')) + 1;
      if (index >= that.links.length)
        return;
      that.select(index);
      that.helpers.scrollCheck();
    },
    selectPrev: function() {
      var index = parseInt(selected.attr('data-index')) - 1;
      if (index < 0)
        return;
      that.select(index);
      that.helpers.scrollCheck();
    },
    enableResize: function() {
      $(window).resize(function() { that.resize(true); });
    },
    enableScroll: function() {
      if (config.hover_scroll) {
        $('#scroll-left').hover(function() {
          scrolling = true;
          that.helpers.scroll(-10);
        }, function() { scrolling = false; });
        $('#scroll-right').hover(function() {
          scrolling = true;
          that.helpers.scroll(10);
        }, function() { scrolling = false });
      } else {
        $('#scroll-left').click(function(e) {
          that.helpers.scrollPrevPage();
          e.preventDefault();
        });
        $('#scroll-right').click(function(e) {
          that.helpers.scrollNextPage();
          e.preventDefault();
        });
      }
    },
    enableLinks: function() {
      var links = container.find('.thumbnail');
      links.hover(function() {
        $(this).addClass('hover');
      }, function() {
        $(this).removeClass('hover');
      });
      links.click(function() {
        that.select($(this).attr('data-index'));
      });
    },
    enableKeyboard: function() {
      var keyHandler = function(e) {
        if (e.target.nodeName == 'INPUT')
          return;
        var d = that.selected().data;
        switch (e.which) {
          // j - next
          case 106: case 74:
            that.helpers.selectNext();
            break;
          // k - prev
          case 107: case 75:
            that.helpers.selectPrev();
            break;
          // v, enter - open link
          case 118: case 86: case 13:
            window.open(d.data.url, '_blank');
            break;
          // c, n - open comments
          case 99: case 67: case 110: case 78:
            window.open('http://www.reddit.com' + d.permalink, '_blank');
            break;
          // r - open subreddit page
          case 114: case 82:
            window.open('http://www.reddit.com/r/' + d.data.subreddit, '_blank');
            break;
          // s - simplify UI
          case 115: case 83:
            if (simple) {
              $('#post-meta').css('margin-top', '0');
              simple.remove();
              simple = null;
            } else {
              $('#post-meta').css('margin-top', '40px');
              simple = $('<div></div>');
              simple.html('Press f again to unhide UI').attr('id', 'noty');
              $('body').append(simple);
              setTimeout(function() {
                simple.fadeOut(1500);
              }, 3000)
            }
            $('#link-container, #header').toggle();
            that.resize();
            break;
          // o - choose subreddits
          case 111: case 79:
            // hacky hack way because my code layering is dumb
            if ($('#subreddits-container').css('right') == '-310px') {
              $('a[data-name=subreddits]').trigger('click');
              $('#subreddits-container').stop(true, true);
            }
            $('#subreddits-controls .add').trigger('click');
            e.preventDefault();
            break;
        }
      }

      $(document).on('keydown', keyHandler);
    },
    hide: function(selection) {
      selection
        .transition()
        .duration(500)
        .style('width', '0px')
        .style('margin-left', '0px')
        .style('margin-right', '0px')
        .style('opacity', '0')
        .remove();
    },
    show: function(selection) {
      selection
        .style('background', function(d) { return '#eee url(' + d.data.thumbnail + ') no-repeat center'; })
        .style('opacity', '0')
        .style('width', '0px')
        .transition()
        .duration(500)
        .style('opacity', '1.0')
        .style('width', '70px')
    },
    preload: function(link) {
      if (link.type == 'image') {
        var timer;
        link.img = $('<img/>');
        link.img.error(function() { link.type = 'page'; });
        link.img.attr('src', link.data.url);
        link.thumb = $('<img/>').attr('src', link.data.thumbnail);

        that.helpers.showLoading('bar');
        link.thumb.on('load', function() {
          that.helpers.hideLoading('bar');
        });
      }
    },
    processVideo: function(link) {
      var elem = $('<div></div>');
      elem.html(that.helpers.htmlUnescape(link.data.media_embed.content));
      var frame = elem.find('iframe')
      // Preserve aspect ratio for video iframes
      var ratio = frame.attr('width') / frame.attr('height');
      frame
        .addClass('video post-content')
        .removeAttr('width')
        .removeAttr('height');
      link.video = frame;
      link.ratio = ratio;
    },
    htmlUnescape: function(value){
        return String(value)
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&');
      }
  }

  // Implements fetching in this module
  this.fetch = fetcher;

  this.helpers.enableScroll();
  this.helpers.enableResize();
  this.helpers.enableKeyboard();

  // Fetch initial links
  this.reset();
}

// YouTube API callback
function onYouTubePlayerReady(playerId) {
  console.log('YouTube API ready');
}

$(document).ready(function() {
  console.log('DOM ready');

  readParams();
  loadTemplates();
  window.rib = new RedditImageBrowser();
  rib.init();
});