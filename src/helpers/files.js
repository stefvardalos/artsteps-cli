const fs = require('fs-extra');
const settingsService = require("../services/settings");
const userFilePath = settingsService.getSetting("userFilePath"); // "/var/artsteps/files/users"



const createFolder = ( folderPath , folderName ) => {
    return fs.ensureDir( folderPath + '/' + folderName );
}

const copyUserFiles = ( oldUser , newUser , filesObject ) => {

    return fs.ensureDir( userFilePath + '/' + newUser)
        .then(() => {
            const oldFiles = Object.keys(filesObject);
            const fileCopyPromises = oldFiles.map((fileName) => {
                return fs.copy(
                    userFilePath + '/' + oldUser + '/' + fileName ,
                    userFilePath + '/' + newUser + '/' + filesObject[fileName]
                )
            })
            return Promise.all(fileCopyPromises);
        })

}


module.exports = {
    createFolder ,
    copyUserFiles
}



