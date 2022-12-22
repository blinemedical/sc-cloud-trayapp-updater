// Native
const urlHelpers = require('url')

// Packages
const { send } = require('micro')
const { valid, compare } = require('semver')
const { parse } = require('express-useragent')
const distanceInWordsToNow = require('date-fns/distance_in_words_to_now')

// Utilities
const checkAlias = require('./aliases')
const prepareView = require('./view')

module.exports = ({ cache, config }) => {
  const { loadCache } = cache
  const exports = {}

  // Helpers
  exports.download = async (req, res) => {
    const userAgent = parse(req.headers['user-agent'])
    const params = urlHelpers.parse(req.url, true).query
    const isUpdate = params && params.update

    let platform

    if (userAgent.isMac && isUpdate) {
      platform = 'darwin'
    } else if (userAgent.isMac && !isUpdate) {
      platform = 'dmg'
    } else if (userAgent.isWindows) {
      platform = 'msi'
    }

    // Get the latest version from the cache
    const { platforms } = await loadCache()

    if (!platform || !platforms || !platforms[platform]) {
      send(res, 404, 'No download available for your platform!')
      return
    }

    res.writeHead(302, {
      Location: platforms[platform].url
    })

    res.end()
  }

  exports.downloadPlatform = async (req, res) => {
    const params = urlHelpers.parse(req.url, true).query
    const isUpdate = params && params.update

    let { platform } = req.params

    if (platform === 'mac' && !isUpdate) {
      platform = 'dmg'
    }

    if (platform === 'mac_arm64' && !isUpdate) {
      platform = 'dmg_arm64'
    }

    // Get the latest version from the cache
    const latest = await loadCache()

    // Check platform for appropiate aliases
    platform = checkAlias(platform)

    if (!platform) {
      send(res, 500, 'The specified platform is not valid')
      return
    }

    if (!latest.platforms || !latest.platforms[platform]) {
      send(res, 404, 'No download available for your platform')
      return
    }

    res.writeHead(302, {
      Location: latest.platforms[platform].url
    })

    res.end()
  }

  exports.update = async (req, res) => {
    const { platform: platformName, version } = req.params

    if (!valid(version)) {
      send(res, 500, {
        error: 'version_invalid',
        message: 'The specified version is not SemVer-compatible'
      })

      return
    }

    const platform = checkAlias(platformName)

    if (!platform) {
      send(res, 500, {
        error: 'invalid_platform',
        message: 'The specified platform is not valid'
      })

      return
    }

    // Get the latest version from the cache
    const latest = await loadCache()

    if (!latest.platforms || !latest.platforms[platform]) {
      res.statusCode = 204
      res.end()

      return
    }

    // Previously, we were checking if the latest version is
    // greater than the one on the client. However, we
    // only need to compare if they're different (even if
    // lower) in order to trigger an update.

    // This allows developers to downgrade their users
    // to a lower version in the case that a major bug happens
    // that will take a long time to fix and release
    // a patch update.

    if (compare(latest.version, version) !== 0) {
      const { notes, pub_date } = latest

      send(res, 200, {
        name: latest.version,
        notes,
        pub_date,
        url: latest.platforms[platform].url
      })

      return
    }

    res.statusCode = 204
    res.end()
  }

  exports.squirrelWindows = async (req, res) => {
    const { filename } = req.params
    // Get the latest version from the cache
    const latest = await loadCache()

    if (filename.toLowerCase().startsWith('releases')) {
      if (!latest.files || !latest.files.RELEASES) {
        res.statusCode = 204
        res.end()

        return
      }

      const content = latest.files.RELEASES

      res.writeHead(200, {
        'content-length': Buffer.byteLength(content, 'utf8'),
        'content-type': 'application/octet-stream'
      })

      res.end(content)
    } else if (filename.toLowerCase().endsWith('nupkg')) {
      if (!latest.platforms || !latest.platforms.nupkg) {
        res.statusCode = 204
        res.end()

        return
      }

      const nupkgAsset = latest.platforms.nupkg

      res.writeHead(302, {
        Location: nupkgAsset.url
      })
      res.end()
    } else {
      res.statusCode = 400
      res.end()
    }
  }

  exports.overview = async (req, res) => {
    const latest = await loadCache()

    const files = {
      mac: latest.platforms.darwin,
      windows: latest.platforms.msi
    }

    try {
      const render = await prepareView()

      const details = {
        account: config.account,
        repository: config.repository,
        date: distanceInWordsToNow(latest.pub_date, { addSuffix: true }),
        files,
        version: latest.version,
        releaseNotes: `https://github.com/${config.account}/${
          config.repository
        }/releases/tag/${latest.version}`,
        allReleases: `https://github.com/${config.account}/${
          config.repository
        }/releases`,
        github: `https://github.com/${config.account}/${config.repository}`
      }

      send(res, 200, render(details))
    } catch (err) {
      console.error(err)
      send(res, 500, 'Error reading overview file')
    }
  }

  return exports
}
