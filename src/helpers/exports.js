const fs = require('fs-extra');
const chalk = require('chalk');
const { Parser } = require('json2csv');


const saveFile = ( content , fileType , fileName , filePath = './') => {
    if ( fileType === 'csv') {
        content = JSON.parse(content);
        const parser = new Parser( { fields : Object.keys(content[0]) });
        content = parser.parse(content);
    }
    return fs.outputFile( filePath + fileName, content)
        .catch(err => {
            console.log(chalk.red('Failed to write to file'));
            console.error(err)
        })
}

module.exports = {
    saveFile
}



