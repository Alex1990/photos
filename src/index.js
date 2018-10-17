const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const fse = require('fs-extra');
const _ = require('lodash');
const moment = require('moment');
const sharp = require('sharp');

Promise.promisifyAll(fs);

const root = process.cwd();
const imageUrlPrefix = 'https://alex1990.github.io/photos';
const dataPath = path.join(root, 'data');
const distPath = path.join(root, 'dist');
const maxWidth = 768;

function createJsonpResult(imageData, callbackName = '_callback') {
  const data = imageData.map(({ name, meta, images }) => {
    return {
      name,
      meta,
      images: images.map(image => `${imageUrlPrefix}/data/${name}/${path.basename(image)}`),
      smallImages: images.map(image => `${imageUrlPrefix}/dist/${name}/${path.basename(image)}`),
    };
  });
  const sortedData = _.sortBy(data, datum => -moment(datum.meta.date).valueOf());
  return `${callbackName}(
${JSON.stringify(sortedData, null, 2)}
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
        await fse.ensureDir(path.dirname(imageDest));
        await sharp(image)
          .resize({ width: maxWidth })
          .toFile(imageDest);
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
