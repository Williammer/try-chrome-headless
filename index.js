const { ChromeLauncher } = require('lighthouse/lighthouse-cli/chrome-launcher');

const chrome = require('chrome-remote-interface');
const path = require('path');
/**
 * Launches a debugging instance of Chrome on port 9222.
 * @param {boolean=} headless True (default) to launch Chrome in headless mode.
 *     Set to false to launch Chrome normally.
 * @return {Promise<ChromeLauncher>}
 */
function launchChrome(headless = true) {
  const launcher = new ChromeLauncher({
    port: 9222,
    autoSelectChrome: true, // False to manually select which Chrome install.
    additionalFlags: [
      '--window-size=412,732',
      '--disable-gpu',
      headless ? '--headless' : ''
    ]
  });

  return launcher.run()
    .then(() => launcher).catch(err => {
      return launcher.kill()
        .then(() => {
          // Kill Chrome if there's an error.
          throw err;
        }, console.error);
    });
}

launchChrome()
  .then(launcher => {
    chrome.Version()
      .then(version => console.log(version['User-Agent']));

    chrome(protocol => {
      // Extract the parts of the DevTools protocol we need for the task.
      // See API docs: https://chromedevtools.github.io/devtools-protocol/
      const { Page } = protocol;

      // First, enable the Page domain we're going to use.
      Page.enable()
        .then(() => {
          Page.navigate({ url: 'https://www.chromestatus.com/' });

          // Wait for window.onload before doing stuff.
          Page.loadEventFired(() => {
            onPageLoad(Page)
              .then(response => {
                console.log(
                  'after getting the data -- data.length: ' + response.data.length
                );
                const data = response.data;

                return saveOutputData(data)
                  .then(() => {
                    console.log('Kill Chrome.');
                    protocol.close();
                    launcher.kill(); // Kill Chrome.
                  });
              });
          });
        });
    }).on('error', err => {
      throw Error('Cannot connect to Chrome:' + err);
    });
  });

function onPageLoad(Page) {
  return Page.getAppManifest()
    .then(response => {
      if (response.url) {
        console.log('Manifest: ' + response.url);
        console.log(response.data);
      }

      console.log('start to print pdf...');
      return Page.printToPDF();
      // console.log('start to capture screenshot...')
      // return Page.captureScreenshot();
    });
}

function saveOutputData(data) {
  return new Promise((resolve, reject) => {
    require('fs').writeFile(
      path.resolve(__dirname, 'treasure.pdf'),
      data,
      'base64',
      function(err) {
        if (err) {
          console.log(err);
          reject(err);
          return;
        }

        resolve();
      }
    );
  });
}
