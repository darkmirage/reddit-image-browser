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
    success: function(json) {
      console.log('Fetched: ' + full_url);
      console.debug(json);
      callback(json, full_url);
    }
  });
}

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
  console.debug(params);
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

  // Configurations
  rib.config = {};
  rib.config.cage_id = '#ribcage';
  rib.config.sub_id = '#subreddits';
  rib.config.defaults = ['aww', 'pics', 'cringepics', 'gifs', 'videos'];
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
  }

  // Parse configurations
  rib.set(config);

  // Default callback to parse returned JSON
  rib.parse = function(json) {
    if (json.kind != 'Listing')
      return;

    // Reddit API object type
    var type_prefix = json.data.after.substr(0, 2);
    var list = json.data.children;

    // On hindsight, I did not need to make a general parser...
    switch (type_prefix) {
      case 't1':
        // Comment
        break;
      case 't2':
        // Account
        break;
      case 't3':
        // Link
        rib.links.parse(list);
        break;
      case 't4':
        // Message
        break;
      case 't5':
        // Subreddit
        rib.subreddits.parse(list);
        break;
      case 't6':
        // Award
        break;
      case 't8':
        // PromoCampaign
        break;
    }
  }

  // Implments fetching in this module
  rib.fetch = function(args, callback) {
    if (callback === undefined)
      callback = rib.parse;
    fetcher(args, callback);
  }

  rib.add = function(subreddit) {
    rib.main.add(subreddit);
  }

  rib.remove = function(subreddit) {
    rib.main.remove(subreddit);
  }

  rib.enableSubreddits = function() {
    rib.subview.find('a').on('click', function() {
    if ($(this).hasClass('active'))
      rib.remove($(this).attr('data-name'));
    else
      rib.add($(this).attr('data-name'));
    $(this).toggleClass('active');
    });
  }

  rib.addSubreddit = function(name) {
    var item = {}
    item.display_name = name;
    var elem = $(templates.subreddit({ item: item }));
    elem.find('a').addClass('active');
    $(rib.config.sub_id).append(elem);
    rib.enableSubreddits();
    rib.add(name);
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
      };
      var hide = function() {
        subParent.animate({'right': '-310px'}, 500);
        handle.removeClass('active');
        toggleSub = false;
      };

      handle.click(function(e) {
        if (!toggleSub && !toggleFAQ) show();
        else hide();
        e.preventDefault();
      });

      rib.subview.parent().find('.close').on('click', hide);
    }

    var enableGuide = function(handle) {
      var guide = $('#guide');
      handle.hover(function() {
        if (toggleFAQ) return;
        var left = ($(window).width() - guide.width()) / 2;
        guide.css('left', left + 'px');
        guide.fadeIn(0);
        $('#dark').fadeIn(500);
      }, function() {
        if (toggleFAQ) return;
        guide.fadeOut(0);
        $('#dark').fadeOut(500);
      });
    }

    var enableFAQ = function(handle) {
      var show = function() {
        faqView.show();
        handle.addClass('active');
        toggleFAQ = true;
        $('#dark').fadeIn(500);
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
    $('#faq').click(function() {
      $('a[data-name=faq]').trigger('click');
    });
    $('#faq .page-content').click(function(e) { e.stopPropagation(); });
  }

  rib.init = function() {
    // Subreddit selection
    rib.subreddits = new ItemList(rib.subview, templates.subreddit);
    // Initialize main view
    rib.main = new MainView(rib.config);

    rib.enableHandles();

    // Fetch subreddit selections
    rib.fetch({ type: 'subreddits', name: 'popular' }, function(json) {
      rib.parse(json);

      // Initialize default selection of subs
      for (var i = 0; i < rib.main.subs.length; i++) {
        $('a[data-name=' + rib.main.subs[i] + ']').addClass('active');
      }
      rib.enableSubreddits();
    });
  }
}

// Item parsing and rendering for the main links
function MainView(config) {
  var that = this;

  this.subs = config.defaults.slice(0);
  this.links = [];
  this.urls = [];
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
    that.subs.push(entry);
    limit += 10;
    that.reset();
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
    that.links = [];
    that.urls = [];
    after = null;
    limit = 30;
    that.helpers.scrollHome();
    that.more(function(json) {
      that.select(0);
      if (callback !== undefined)
        callback(json);
    });
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
          that.helpers.scroll(-700, -1);
          e.preventDefault();
        });
        $('#scroll-right').click(function(e) {
          that.helpers.scroll(700, -1);
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
        var d = that.selected().data;
        switch (e.which) {
          // j - prev
          case 106: case 74:
            that.helpers.selectPrev();
            break;
          // k - next
          case 107: case 75:
            that.helpers.selectNext();
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
          // f - simplify UI
          case 102: case 70:
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
            $('a[data-name=subreddits]').trigger('click');
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
        link.img = $('<img/>').attr('src', link.data.url);
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

  // Enable resize
  this.helpers.enableResize();

  // Fetch initial links
  this.reset();

  this.helpers.enableKeyboard();
}

// Generic item parsing and rendering
function ItemList(container, template) {
  var that = this;
  this.list = [];

  this.parse = function(list) {
    that.list = that.list.concat(list);
    this.render();
  }

  this.render = function() {
    for (var i = 0; i < that.list.length; i++) {
      var item = that.list[i].data;
      var elem = template({ item: item });
      container.append(elem);
    }
  }
}

$(document).ready(function() {
  console.log('DOM ready');

  readParams();
  loadTemplates();
  window.rib = new RedditImageBrowser();
  rib.init();
});