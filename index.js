'use strict'

const browserify = require('browserify')
const requireWatch = require('require-watch').default
require('babel-register')

module.exports = Object.assign(recharge, recharge())
if (module === require.main) recharge.main(process.argv)

const {renderToString: render} = require('react-dom/server')
const HTML = Symbol()
Object.prototype[HTML] = function({scripts=[]}={}) {
  return `<html>
  <head></head>
  <body>
    <div id=main>${render(this)}</div>
    ${
      scripts.map(
        src => `<script src='${src}'></script>`
      ).join('\n')
    }    
  </body>
  </html>`
}

function recharge({
  fs=require('fs'),
  Rx=require('rxjs'),
  chokidar=require('chokidar'),
  path=require('path'),
  browserify=require('browserify'),
  through=require('through')
}={}) {
  const {join, dirname} = path
  const tee = (func=console.log) => x => (func(x), x)
  const basename = (path, ext) =>
    path.slice(0, path.lastIndexOf('.')) +
    (ext ? `.${ext}` : '')

  function main([_node, _indexjs, input='.', output='./ZAP']) {
    const watcher = chokidar.watch(input, {
      ignored: 'node_modules',
      persistent: true,
      alwaysStat: true,
    })

    const watch = event => 
      Rx.Observable.create(sub => {
        const next = (path, stat) => sub.next({event, path, stat})
        watcher.on(event, next)
        // return () => watcher.off(event, next)
      })
  
    const current = [
      'add', 'change', 'unlink',
      'addDir', 'unlinkDir', 'error', 'ready',
      'raw'
    ].reduce((all, event) =>
      Object.assign({}, all, {
        [event]: watch(event)
      }),
      {}
    )
    
    const isJsx = ({path}) => path.endsWith('.jsx')
    const {add, change, unlink} = current

    const mkdirp = require('mkdirp')

    const dst = (path, ext) =>
      join(output, basename(path, ext))

    add.merge(change)
      .filter(isJsx)
      .map(tee())
      .map(({path: src}) => ({
        [dst(src, 'html')]: html(src, basename(path.basename(src), 'js')),
        [dst(src, 'js')]: bundle(src),
      }))
      .subscribe(
        streams => Object.keys(streams)
          .forEach(path => {
            mkdirp.sync(dirname(path))
            console.log('writing', path)
            streams[path].pipe(fs.createWriteStream(path, 'utf8'))
              .on('finish', () => console.log('finished', path))
          })
      )
  }

  function html(jsxSrc, ...scripts) {
    const reqPath = require.resolve('./' + basename(jsxSrc))
    requireWatch(reqPath)
    const module = require(reqPath).default
    return fromString(module[HTML]({scripts}))
  }

  function bundle(jsxSrc) {
    const importPath = `'./${path.basename(jsxSrc)}'`
    return browserify()
      .transform('babelify')
      .add(str `
        import {render} from 'react-dom'
        import jsx from ${importPath}

        render(jsx, main)
      `, {basedir: dirname(jsxSrc)})
      .bundle()
  }

  return {main}
}

function bustCache() {
  for (let key in require.cache) {
    delete require.cache[key]
  }
}

const from = require('from2')
function fromString(string) {
  return from(function(size, next) {
    // if there's no more content 
    // left in the string, close the stream. 
    if (string.length <= 0) return next(null, null)
 
    // Pull in a new chunk of text, 
    // removing it from the string. 
    var chunk = string.slice(0, size)
    string = string.slice(size)
 
    // Emit "chunk" from the stream. 
    next(null, chunk)
  })
}

function str(...args) {
  return fromString(String.raw(...args))
}