'use strict';

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const express = require('express');
const generateUuid = require('uuid/v4');

const app = express();

app.disable('etag');
app.disable('x-powered-by');
app.set('view engine', 'ejs');

app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

// I know :-(
const cache = {};
const etagCache = {};

app.use((req, res, next) => {

  const host = req.hostname.startsWith('cookies')
    ? 'root'
    : req.hostname.startsWith('blue')
      ? 'blue'
      : req.hostname.startsWith('green')
        ? 'green'
        : null;

  if (req.url === '/' || req.url === '/index.html') {
    res.render('index.ejs', { host });
  }

  if (req.url === '/simple-session.html') {
    res.set('Set-Cookie', `simple-session=hello`);
    res.render('simple-session.ejs', { host });
  }

  if (req.url === '/simple-persistent.html') {
    res.set('Set-Cookie', `simple-persistent=hello; Max-Age=3600`);
    res.render('simple-persistent.ejs', { host });
  }

  if (req.url.endsWith('/show-cookies.html')) {
    res.render('show-cookies.ejs', {
      host,
      cookieHeader: req.headers.cookie,
      cookies: Object.entries(req.cookies),
    });
  }

  if (req.url === '/delete-simple-cookies.html') {
    res.set('Set-Cookie', [
      `simple-session=; Max-Age=0`,
      `simple-persistent=; Expires=${new Date(0).toUTCString()}`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/domain-attribute.html') {
    res.set('Set-Cookie', [
      `no-domain=no`,
      `root-domain=root; Domain=cookies.rocks`,
      `blue-subdomain=blue; Domain=blue.cookies.rocks`,
      `green-subdomain=green; Domain=green.cookies.rocks`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/path-attribute.html') {
    res.set('Set-Cookie', [
      `no-path=no`,
      `foo-path=foo; Path=/foo`,
      `bar-path=bar; Path=/bar`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/secure-attribute.html') {
    res.set('Set-Cookie', [
      `no-secure=no`,
      `secure=secure; Secure`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url === '/httponly-attribute.html') {
    res.set('Set-Cookie', [
      `no-httponly=no`,
      `httponly=httponly; HttpOnly`,
    ]);
    res.redirect(302, '/show-cookies.html');
  }

  if (req.url.endsWith('/tracking-image.html')) {
    let sites = [];
    const uuid = req.cookies['uuid'];
    if (uuid != null && cache[uuid] != null) {
      sites = cache[uuid].sites;
    }
    res.render('tracking-image.ejs', { host, sites });
  }

  if (req.url === '/cookie.svg') {

    let uuid = req.cookies['uuid'];
    if (uuid == null || cache[uuid] == null) {
      uuid = generateUuid();
      cache[uuid] = { sites: [] };
      res.set('Set-Cookie', `uuid=${uuid}`);
    }

    const { referer, 'user-agent': userAgent } = req.headers;
    if (referer != null && !referer.endsWith('/tracking-image.html')) {
      cache[uuid].sites.push({ date: new Date().getTime(), referer, userAgent });
    }

    console.log(cache);
  }

  if (req.url.endsWith('/tracking-image-etag.html')) {
    let sites = [];
    const uuid = req.cookies['etag-uuid'];
    if (uuid != null && etagCache[uuid] != null) {
      sites = etagCache[uuid].sites;
    }
    res.render('tracking-image-etag.ejs', { host, sites });
  }

  if (req.url === '/cookie-etag.svg') {

    let uuid = req.headers['if-none-match'];
    if (uuid == null || etagCache[uuid] == null) {
      uuid = generateUuid();
      etagCache[uuid] = { sites: [] };
    }
    res.set('ETag', uuid);

    const { referer, 'user-agent': userAgent } = req.headers;
    if (referer != null) {
      if (referer.endsWith('/tracking-image-etag.html')) {
        res.set('Set-Cookie', `etag-uuid=${uuid}`);
      } else {
        etagCache[uuid].sites.push({ date: new Date().getTime(), referer, userAgent });
      }
    }

    console.log(etagCache);
  }

  if (req.url === '/profile.html') {
    let uuid = req.cookies['uuid'];
    if (uuid == null || cache[uuid] == null) {
      uuid = generateUuid();
      cache[uuid] = { sites: [] };
      res.set('Set-Cookie', `uuid=${uuid}`);
    }
    const profile = cache[uuid].profile;
    res.render('profile.ejs', { host, profile });
  }

  if (req.path === '/update-profile.html') {
    let uuid = req.cookies['uuid'];
    if (uuid == null || cache[uuid] == null) {
      uuid = generateUuid();
      cache[uuid] = { sites: [] };
      res.set('Set-Cookie', `uuid=${uuid}`);
    }
    cache[uuid].profile = {
      firstname: req.query.firstname || req.body.firstname,
      lastname: req.query.lastname || req.body.lastname,
    };
    res.redirect(302, './profile.html');
  }

  next();
});

app.use(express.static('public', {
  etag: false,
  maxAge: 0,
  lastModified: false,
}));

const port = process.env.PORT || 8080;
app.listen(port);
