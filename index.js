'use strict'

require('babel-register')

const recharge = ({
  fs=require('fs'),
  Rx=require('rx'),
  chokidar=require('chokidar'),
  join=require('path').join
}={}) => {
  const readdir = dir =>
    new Promise(
      (resolve, reject) =>
        fs.readdir(dir, (err, ok) => resolve(err || ok)))

  function walk(visitor, path='.') {
    return Promise.all([
      visitor(path),
      readdir(path)
        .then(entries =>
          Promise.all(entries.map(child => walk(visitor, join(path, child)))))
    ])
  }

  function main(argv) {
    const [_node, _indexjs, output, input='.'] = argv
    const watcher = chokidar.watch('.', {
      // ignored: /(^[\/\\])\../,
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
    // current.add.filter(isJsx)    
    //   .subscribe(console.log)

    // current.change.filter(isJsx)
    //   .subscribe(console.log)


    add.merge(change).merge(unlink)
      .filter(isJsx)
      .subscribe(console.log)

    const watchRx = require('watch-rx')

    const {renderToString: render} = require('react-dom/server')
    const mkdirp = require('mkdirp')
    const Path = require('path')
    add.filter(isJsx)
      .map(event => 
        Object.assign({
          module: require('./' + event.path).default,
        }, event))
      .subscribe(
        ({module, path}) => {
          const outFile = './ZAP/' + path.slice(0, path.length - 3) + 'html'
          mkdirp.sync(Path.dirname(outFile))
          fs.writeFileSync(outFile, render(module))
        })
  }

  return {walk, main}
}

module.exports = Object.assign(recharge, recharge())

if (module === require.main) recharge.main(process.argv)