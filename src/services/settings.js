const Conf = require('conf');
const chalk = require('chalk');


const config = new Conf();

const setSetting = ( settingKey , settingValue) => {
    config.set(settingKey, settingValue);
}

const getSetting = ( settingKey ) => {
    return config.get(settingKey);
}

const deleteSetting = ( settingKey ) => {
    config.delete(settingKey);
}

const existSetting = ( settingKey ) => {
    return config.has(settingKey);
}

const checkSettings = () => {
    if (
        existSetting('mongoURL') &&
        existSetting('dbName') &&
        existSetting('userFilePath')
    ) {
        return true;
    } else {
        console.log('-----')
        console.log( chalk.red('You need to initialize your settings first!') );
        console.log( chalk.italic.green('Run settings -s') );
        console.log('-----')
        return false;
    }
}

const getAllSettings = () => {
    return config.store;
}

const getFilePath = () => {
    return config.path;
}

const resetSettings = () => {
    config.clear();
}

module.exports = {
    setSetting ,
    getSetting ,
    deleteSetting ,
    existSetting ,
    checkSettings ,
    getAllSettings ,
    getFilePath ,
    resetSettings
}
