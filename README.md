# Reddit Image Browser

**RIB** is a client-side image browser for Reddit. The application uses jQuery to fetch and process unauthenticated JSONP. Some rendering is done with [D3.js](http://d3js.org/) with the eventual goal of creating richer visualizations and user interactivity. HTML 5 Local Storage is used to maintain state.

I made this mainly for my own use because I wanted an easy and smooth way of flipping through r/pics.

## Usage

**RIB** is meant to be a fast and easy way to browse all image posts on Reddit. Due to browser security protection against cross origin scripting, RIB can only provide unauthenticated read-only browsing. The live version of the site can be found at [rib.soraven.com](http://rib.soraven.com)

There is currently no support for mobile devices.

## Features

- Runs entirely in your browser.
- Identifies post type (i.e. NSFW, videos, self) and displays content in an appropriate format.
- Infinite scrolling with automatic asynchronous loading.
- Hotkeys, such as `j` to go to next post and `c` to open comments page, enable fast browsing.
- Your subreddit selections persist across sessions via HTML 5 Local Storage.
- Local Storage support for IE provided by Remy Sharp's [storage polyfill](https://github.com/inexorabletash/polyfill/blob/master/storage.js).
- Retries on load error.

## Todo

- Data visualization (e.g. treemaps) using D3.js.
- Implement YouTube API callback function to allow better video controls.
- Load top comments on demand.
- Make keyboard shortcut work for Imgur albums.
- Option to filter by post type.
- Zoom and resize options.
- Responsive layout. (Probably not...)
- Mobile support?

## Contact

You can [reach me](http://soraven.com/contact) through my blog at http://soraven.com.

## Icons

Most of the icons used in RIB came from the [Modern Pictograms](http://www.fontsquirrel.com/fonts/modern-pictograms) dingbat font by John Caserta. The rest came from the unicode charset.
