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

// Underscore.js templates
var templates = {};
templates.user = '<div>' +
                 '<%= item.name %>' +
                 '</div>';

templates.link = '<a href="http://www.reddit.com<%= item.permalink %>"><h2><%= item.title %></h2></a>';

templates.subreddit = '<li>' +
                     '<a href="#" name="<%= item.display_name %>">' +
                     '<%= item.display_name %>' +
                     '</a>' +
                     '</li>';

templates.meta = '<h3 class="box shadow"><%= item.title %></h3>' +
                 '<div class="box shadow"></div>'

// Main RIB class
function RedditImageBrowser(config) {
  console.log('Initializing RIB');
  var rib = this; // Humor me

  // Configurations
  rib.config = {};
  rib.config.cage_id = '#ribcage';
  rib.config.sub_id = '#subreddits';
  rib.config.defaults = ['pics'];

  // Configuration parser
  rib.set = function(config) {
    if (config !== undefined) {
      if (config.cage_id !== undefined)
        rib.config.cage_id = config.cage_id;
    }

    rib.cage = $(rib.config.cage_id);
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

  rib.init = function() {
    // Subreddit selection
    var container = $(rib.config.sub_id);
    rib.subreddits = new ItemList(container, templates.subreddit);
    var handle = $('a[name=subreddits]');

    var parent = container.parent();
    handle.hover(function() {
      parent.stop(true, false).animate({'right': '-10px'}, 900);
    }, function() {
    });
    parent.hover(function() {}, function() {
      parent.animate({'right': '-310px'}, 800);
    });

    // Initialize main view
    rib.main = new MainView(rib.config.defaults, rib.cage);

    // Fetch subreddit selections
    rib.fetch({ type: 'subreddits', name: 'popular' }, function(json) {
      rib.parse(json);

      // Initialize default selection of subs
      for (var i = 0; i < rib.main.subs.length; i++) {
        $('a[name=' + rib.main.subs[i] + ']').addClass('active');
      }

      container.find('a').on('click', function() {
        if ($(this).hasClass('active'))
          rib.remove($(this).attr('name'));
        else
          rib.add($(this).attr('name'));
        $(this).toggleClass('active');
      });
    });
  }
}

// Item parsing and rendering for the main links
function MainView(subs, parent) {
  var that = this;

  this.subs = subs.slice(0);
  this.links = [];
  this.urls = [];
  var after = null;
  var limit = 30;

  var template = _.template(templates.link);
  var meta_template = _.template(templates.meta);
  var container = $('#links');
  this.container = container;
  var content = d3.select('#links');
  var curr = $('#post');
  var meta = $('#post-meta');

  var scrolling = false;
  var loading = false;
  var selected = null;

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
    that.helpers.format();
    that.render();
    loading = false;
    that.helpers.hideLoading();
  }

  this.more = function(callback) {
    if (loading)
      return;
    loading = true;
    that.helpers.showLoading();

    var name = that.subs.join('+');
    args = {};
    args.type = 'r';
    args.name = name;
    if (after != null)
      args.after = after;

    that.fetch(args, function(json, url) {
      that.parse(json, url);
      if (callback !== undefined)
        callback(json);
    });
  }

  this.reset = function(callback) {
    that.links = [];
    that.urls = [];
    after = null;
    limit = 30;
    that.helpers.scrollHome();
    that.more(callback);
  }

  // Display the selected item
  this.display = function(link) {
    d = link.data;

    var content = $('<div></div>').addClass('shadow');
    var old = curr.find('.shadow');


    if (link.type == 'image') {
      var elem = link.img;
    }
    else if (link.type == 'album') {
      var elem = $('<iframe></iframe>');
      elem
        .addClass('imgur-album')
        .attr('frameborder', 0)
        .attr('src', link.data.url + '/embed');
      link.iframe = elem;
    }

    content.attr('id', d.name);
    content.append(elem);
    meta.html(meta_template({ item: d }));
    old.remove();
    curr.append(content);
  }

  // Basic rendering of thumbnails with no paging
  this.render = function() {
    var update = content.selectAll('span')
      .data(that.links, function(d) { return d.data.name; });

    update
      .attr('data-index', function(d, i) { return i; })
      .style('left', function(d, i) { return (5 + i * 77) + 'px' });

    update.exit()
      .call(that.helpers.hide);

    update.enter()
      .append('span')
      .style('left', function(d, i) { return (5 + i * 77) + 'px' })
      .html(function(d) { return template({ item: d.data }); })
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

    // Kind of hacky? Couldn't get d3 selects to work for [data-index=]
    that.display(elem[0].__data__);
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
      that.container.scrollLeft(0);
      $('#scroll-left').hide();
    },
    scroll: function(rate, i) {
      if (i === undefined)
        i = 0;

      if (!scrolling && i >= 0)
        return;

      var x = that.container.scrollLeft();
      that.container.scrollLeft(container.scrollLeft() + rate);

      if (that.container.scrollLeft() == 0) {
        $('#scroll-left').hide();
        return;
      } else {
        $('#scroll-left').show();
      }

      if (x == that.container.scrollLeft() && !loading) {
        that.more();
      }

      // Someday I'll figure out how to put an ease function into this...
      // rate = i >= 200 && i < 300 ? rate * 1.02 : rate;
      // console.debug(that.container.scrollLeft());

      // Set i to negative for a one-off scroll job!
      if (i < 0)
        return;
      // Continuously scroll otherwise
      setTimeout(function() {
        that.helpers.scroll(rate, i + 1);
      }, 10);
    },
    selectNext: function() {
      var index = parseInt(selected.attr('data-index')) + 1;
      if (index < that.links.length) {
        that.select(index);
      }
      if (index > that.links.length - 5) {
        that.more();
      }
    },
    selectPrev: function() {
      var index = parseInt(selected.attr('data-index')) - 1;
      if (index >= 0) {
        that.select(index);
      }
    },
    enableScroll: function() {
      $('#scroll-left').hover(function() {
        scrolling = true;
        that.helpers.scroll(-10);

      }, function() { scrolling = false; });
      $('#scroll-right').hover(function() {
        scrolling = true;
        that.helpers.scroll(10);
      }, function() { scrolling = false });
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
        switch (e.which) {
          case 106:
          case 74:
            that.helpers.selectPrev();
            break;
          case 107:
          case 75:
            that.helpers.selectNext();
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
    format: function() {
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

        if (d.thumbnail == '') {
          d.thumbnail = './img/nothumb.png';
        }
        else if (d.thumbnail == 'default') {
          d.thumbnail = './img/nothumb.png';
        }
        else if (d.thumbnail == 'self') {
          d.thumbnail = './img/self.png';
          link.type = 'self';
        }
        else if (d.thumbnail == 'nsfw') {
          d.thumbnail = './img/nsfw.png';
        }

        if (link.type === undefined) {
          link.type = 'page';
        }

        // preload images
        that.helpers.preload(link);
      }
    }
  }

  // Implements fetching in this module
  this.fetch = fetcher;

  this.helpers.enableScroll();

  // Fetch initial links
  this.reset(function() {
    that.select(0);
  });

  this.helpers.enableKeyboard();
}

// Generic item parsing and rendering
function ItemList(container, template) {
  var that = this;
  this.list = [];
  template = _.template(template);

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

  window.rib = new RedditImageBrowser();
  // rib.fetch({ type: 'hot', limit: 4, after: 'test' });

  rib.init();
  // rib.fetch({type: 'user', name: 'DarkMirage'});
  setTimeout(function() {
    $('a[name=subreddits]').trigger('click');
  }, 0);
});