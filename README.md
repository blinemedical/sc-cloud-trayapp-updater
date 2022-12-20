# SimCapture Cloud Tray App Update Server

This is the update server for the SimCapture Cloud Tray App. It allows us to serve up the latest releases and automatically update existing customers' tray apps.

It is built from Hazel and deploys to Vercel.

## Deployments

The production version of this update server is available at https://trayapp-updater.simcapture.com.

The staging version of this update server is available at https://sc-cloud-trayapp-updater-git-staging-laerdal-labs.vercel.app. This version caches pre-releases as well as production releases so it is good for testing new tray-app releases before they're shipped to production.

## Configuration

The following environment variables can be used optionally:

- `INTERVAL`: Refreshes the cache every x minutes ([restrictions](https://developer.github.com/changes/2012-10-14-rate-limit-changes/)) (defaults to 15 minutes)
- `PRE`: When defined with a value of `1`, pre-releases will be cached as well as production releases
- `TOKEN`: Your GitHub token (for private repos)
- `URL`: The server's URL (for private repos - when running on [Vercel](https://vercel.com), this field is filled with the URL of the deployment automatically)

## Statistics

Since Hazel routes all the traffic for downloading the actual application files to [GitHub Releases](https://help.github.com/articles/creating-releases/), you can use their API to determine the download count for a certain release.

As an example, check out the [latest Hyper release](https://api.github.com/repos/vercel/hyper/releases/latest) and search for `mac.zip`. You'll find a release containing a sub property named `download_count` with the amount of downloads as its value.

## Routes

### /

Displays an overview page showing the cached repository with the different available platforms and file sizes. Links to the repo, releases, specific cached version and direct downloads for each platform are present.

### /download

Automatically detects the platform/OS of the visitor by parsing the user agent and then downloads the appropriate copy of your application.

If the latest version of the application wasn't yet pulled from [GitHub Releases](https://help.github.com/articles/creating-releases/), it will return a message and the status code `404`. The same happens if the latest release doesn't contain a file for the detected platform.

### /download/:platform

Accepts a platform (like "darwin" or "win32") to download the appropriate copy your app for. I generally suggest using either `process.platform` ([more](https://nodejs.org/api/process.html#process_process_platform)) or `os.platform()` ([more](https://nodejs.org/api/os.html#os_os_platform)) to retrieve this string.

If the cache isn't filled yet or doesn't contain a download link for the specified platform, it will respond like `/`.

### /update/:platform/:version

Checks if there is an update available by reading from the cache.

If the latest version of the application wasn't yet pulled from [GitHub Releases](https://help.github.com/articles/creating-releases/), it will return the `204` status code. The same happens if the latest release doesn't contain a file for the specified platform.

### /update/win32/:version/RELEASES

This endpoint was specifically crafted for the Windows platform (called "win32" [in Node.js](https://nodejs.org/api/process.html#process_process_platform)).

Since the [Windows version](https://github.com/Squirrel/Squirrel.Windows) of Squirrel (the software that powers auto updates inside [Electron](https://www.electronjs.org)) requires access to a file named "RELEASES" when checking for updates, this endpoint will respond with a cached version of the file that contains a download link to a `.nupkg` file (the application update).
