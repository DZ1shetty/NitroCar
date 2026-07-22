const fs = require('fs');
const path = require('path');

const oldPath = path.join(__dirname, 'assets', 'hero_car.glb');
const newPath = path.join(__dirname, 'assets', 'hero_car_model');

if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log('Renamed folder successfully to hero_car_model');
} else if (fs.existsSync(newPath)) {
    console.log('Folder already renamed to hero_car_model');
} else {
    console.log('Neither folder found');
}
