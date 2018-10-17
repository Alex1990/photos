const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const Promise = require('bluebird');

Promise.promisifyAll(fs);

const root = process.cwd();
const photoPathPrefix = 'https://raw.githubusercontent/Alex1990/photos/master/dist/';
const dataPath = path.join(root, 'data');
const distPath = path.join(root, 'dist');

function createJsonpResult(imageData, callbackName = '_callback') {
  const data = imageData.map(({ name, meta, images }) => {
    return {
      name,
      meta,
      images: images.map(image => `${photoPathPrefix}${name}/${path.basename(image)}`),
    };
  });
  return `${callbackName}(
${JSON.stringify(data, null, 2)}
)`;
}

async function readDirFilter(directory, filter) {
    const fileNames = await fs.readdirAsync(directory);
    const filePaths = fileNames.map(fileName => path.join(directory, fileName));
    return filePaths.filter(filePath => {
      if (filter) {
        return filter(filePath);
      }
      return true;
    });
}

async function main() {
  try {
    const imageDirs = await readDirFilter(dataPath, filePath => {
      return fs.statSync(filePath).isDirectory();
    });
    const imageData = [];

    for (let i = 0; i < imageDirs.length; i++) {
      const imageDir = imageDirs[i];
      const meta = fse.readJsonSync(path.join(imageDir, 'meta.json'));
      const images = await readDirFilter(imageDir, filePath => {
        return /[\w\w+]\.(jpg|jpeg)$/i.test(filePath);
      });
      imageData.push({
        name: path.basename(imageDir),
        meta,
        images,
      });
    }

    for (let i = 0; i < imageData.length; i++) {
      const imageDatum = imageData[i];
      const { name, meta, images } = imageDatum;
      for (let j = 0; j < images.length; j++) {
        const image = images[j];
        const imageDest = path.join(distPath, name, path.basename(image));
        await fse.copy(image, imageDest);
      }
    }

    const jsonpResult = createJsonpResult(imageData, 'photosCallback');
    const jsonpFilePath = path.join(distPath, 'photos.js');
    await fse.outputFile(jsonpFilePath, jsonpResult, 'utf8');
  } catch (err) {
    console.error(err);
  }
}

main();
