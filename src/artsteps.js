#!/usr/bin/env node

'use strict';

const program = require("commander");
const pckg = require( "../package.json" );
const chalk = require("chalk");

const mongoService = require("./services/mongo");
const settingsService = require("./services/settings");
const exportsService = require("./helpers/exports");


program.version(pckg.version);


// error on unknown commands
program.on('command:*', () => {
    console.log( chalk.red('Invalid command: %s\nSee --help for a list of available commands.'), program.args.join(' '));
    process.exit(1);
});

if (process.argv.length === 2) {
    process.argv.push('--help');
}

program
    .command('test')
    .description('Testing ')
    .option('-b, --bool ', 'bool for testing')
    .action( ( options ) => {

        if (settingsService.checkSettings()){
            if (options.hasOwnProperty('bool') && options.bool === true) {
                console.log( settingsService.getSetting('test' ) );
            } else {
                settingsService.setSetting('test' , false);
                console.log('SAVED!');
            }
        }

    });

program
    .command('settings')
    .description('Get/Check Environment Settings')
    .option('-s, --setup', 'Setup Settings')
    .option('-d, --dbname [dbname]', 'Database Name')
    .option('-m, --mongourl [mongourl]', 'Mongo Url')
    .action( ( options ) => {
        if (options.hasOwnProperty('setup') && options.setup === true) {

            if (options.hasOwnProperty('dbname') && options.dbname.length > 0) {
                settingsService.setSetting('dbName' , options.dbname);
            }
            if (options.hasOwnProperty('mongourl') && options.mongourl.length > 0) {
                settingsService.setSetting('mongoURL' , options.mongourl);
            }
        } else {
            console.log('Settings are saved at : ' + settingsService.getFilePath());
            const settings = settingsService.getAllSettings();
            const settingsKeys = Object.keys(settings);
            settingsKeys.forEach((settKey) => {
                console.log(settKey + '  :  ' + settings[settKey]);
            })
        }
    });

program
    .command('copyExhibition')
    .description('Copy Exhibition from one User to Another ')
    .option('-f, --firstEmail [firstEmail]', 'First User\'s  email')
    .option('-s, --secondEmail [secondEmail]', 'Second User\'s  email')
    .option('-e, --exhibitionName [exhibitionName]', 'Second User\'s  email')
    .option('-n, --newExhibitionName [newExhibitionName]', 'New Exhibition name')
    .option('-i, --exhibitionID [exhibitionID]', 'Second User\'s  email')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {

            mongoService.connectDB()
                .then((connectedCliend) => {
                    return Promise.all( [
                        mongoService.getUsers([options.firstEmail , options.secondEmail]),
                        mongoService.getExhibition(options.exhibitionID)
                    ])
                })
                .then((data) => {
                    return mongoService.cloneExhibition(data[1][0] , data[0][0]._id , data[0][1]._id , options.newExhibitionName )
                })
                .then(( copiedExhibition )=> {
                    console.log(chalk.green('Successfully copied Exhibition ' + copiedExhibition.title + ' to User : ' + options.secondEmail ) );
                    console.log(chalk.italic.blue('View at : view/' + copiedExhibition._id ) );
                })
                .catch((err) => {
                    console.log(chalk.red('Something is wrong!') );
                    console.log(err);
                })
                .finally(() => {
                    mongoService.closeDB();
                })
        }

    });


program
    .command('getExhibitions')
    .description('Get All or User\'s Exchibitions ')
    .option('-u, --userEmail [userEmail]', 'User\'s  email')
    .option('-j, --json ', 'Export to JSON data')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {
            mongoService.getUsers([options.userEmail])
                .then((userList) => {
                    return mongoService.getExhibitions(userList[0]._id)
                })
                .then(( exhibitionsList )=> {
                    if ( options.hasOwnProperty('json') && options.json === true ) {
                        console.log(JSON.stringify(exhibitionsList) )
                    } else {
                        console.log(exhibitionsList.length)
                    }
                })
                .finally(() => {
                    mongoService.closeDB();
                })
        }
    });

program
    .command('getSubscribers')
    .description('Get All Users Subscribed to Newsletter')
    .option('-s, --saveFile', 'Save to specific File')
    .option('-j, --json ', 'Export to JSON data')
    .option('-c, --csv ', 'Export to CSV data')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {
            let subList;
            mongoService.getSubscribers()
                .then((subscriberList) => {
                    subList = subscriberList;
                    return mongoService.getUsers(
                        subscriberList.map((subscriber => subscriber.mail))
                    );
                })
                .then((signedUsers) => {
                    let subscribedAndSigned = [];
                    let onlySubscribed = [];
                    subList.forEach((sub) => {
                        const signedUser = signedUsers.find(usr => usr.emails.find(anyMail => anyMail.address === sub.mail));
                        if (signedUser) {
                            sub.name = signedUser.profile.name;
                            subscribedAndSigned.push(sub);
                        } else {
                            onlySubscribed.push(sub);
                        }
                    })
                    if (options.hasOwnProperty('saveFile') && options.saveFile === true) {
                        if ( options.hasOwnProperty('csv') && options.csv === true) {
                            return Promise.all([
                                exportsService.saveFile( JSON.stringify(onlySubscribed) , 'csv' , 'subscribers.' + 'csv' ) ,
                                exportsService.saveFile( JSON.stringify(subscribedAndSigned) , 'csv' , 'userSubscribers.' + 'csv' )
                            ])
                        } else {
                            return Promise.all([
                                exportsService.saveFile( JSON.stringify(onlySubscribed) , 'json' , 'subscribers.' + 'json' ) ,
                                exportsService.saveFile( JSON.stringify(subscribedAndSigned) , 'json' , 'userSubscribers.' + 'json' )
                            ])
                        }
                    } else {
                        console.log(JSON.stringify(onlySubscribed) )
                        console.log(JSON.stringify(subscribedAndSigned) )
                    }
                })
                .catch((err) => {
                    console.log(err);
                })
                .finally(() => {
                    mongoService.closeDB();
                })
        }

    });

program
    .command('info')
    .description('CLI Info ')
    .action( ( options ) => {


        console.log('--------')
        console.log('All OK');
        console.log('--------')
    });

program.parse(process.argv);

