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
                     '<a href="<%= item.url %>" name="<%= item.name %>">' +
                     '<%= item.display_name %>' +
                     '</a>' +
                     '</li>';

// Main RIB class
function RedditImageBrowser(config) {
  console.log('Initializing RIB');
  var rib = this; // Humor me

  // Configurations
  rib.config = {};
  rib.config.cage_id = '#ribcage';
  rib.config.sub_id = '#subreddits';
  rib.config.defaults = ['pics', 'AskReddit'];

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
  rib.fetch = function(args) {
    fetcher(args, rib.parse);
  }

  rib.add = function(subreddit) {
    rib.main.add(subreddit);
  }

  rib.remove = function(subreddit) {
    rib.main.remove(subreddit);
  }

  // Subreddit selection
  var container = $(rib.config.sub_id);
  rib.subreddits = new ItemList(container, templates.subreddit);
  var toggle = $('a[name=subreddits]');
  toggle.click(function(e) {
    container.slideToggle({ duration: 400 });
    toggle.toggleClass('active inactive');
  });

  // Initialize main view
  rib.main = new MainView(rib.config.defaults, rib.cage);
}

// Item parsing and rendering for the main links
function MainView(subs, parent) {
  var that = this;

  // Data
  this.subs = subs.slice(0);
  this.links = [];
  var after = null;

  // Display
  var template = _.template(templates.link);
  var container = $('#links');
  var content = d3.select('#links');
  var curr = $('#post');

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
    that.reset();
  }

  // These operate on the retrieved links
  this.parse = function(json) {
    that.links = that.links.concat(json.data.children);
    after = that.links[that.links.length - 1].data.name;
    that.render();
  }

  this.more = function() {
    var name = that.subs.join('+');
    params = {};
    params.type = 'r';
    params.name = name;
    if (after != null)
      params.after = after;

    that.fetch(params, that.parse);
  }

  this.reset = function() {
    that.links = [];
    after = null;
    that.more();
  }

  this.display = function(d) {
    p = d.data;
    // curr.html('');
    var content = '<div class="shadow">';
    if (p.thumbnail != '') {
      var format = p.url.substr(p.url.length - 3, 3);
      if (_.indexOf(['png', 'jpg', 'gif'], format) != -1) {
        content += '<img src="' + p.url + '" />';
      } else if (p.url.indexOf('imgur.com') != -1) {
        content += '<img src="' + p.url + '.jpg" />';
      }
    }
    content += '</div>';
    curr.fadeOut(100, function() {
      curr.html(content);
    });
    curr.fadeIn(100);
  }

  // Basic rendering with no paging
  this.render = function() {
    var _bg = function(d) {
      if (d.data.thumbnail == '')
        return '#eee';
      else
        return '#eee url(' + d.data.thumbnail + ') no-repeat center';
    }
    content.selectAll('span')
      .data(that.links, function(d) { return d.data.name; })
      .enter().append('span')
      .style('background', _bg)
      .attr('class', 'thumbnail')
      .html(function(d) { return template({ item: d.data }); })
      .on('click', that.display);
  }

  // Implments fetching in this module
  this.fetch = fetcher;

  // Fetch initial links
  this.reset();
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
  rib.fetch({ type: 'subreddits', name: 'popular' });
  // rib.fetch({type: 'user', name: 'DarkMirage'});
  setTimeout(function() {
    $('a[name=subreddits]').trigger('click');
  }, 2000);
});