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

        if (settingsService.checkSettings()) {
            console.log(chalk.green('All Setup'));
        } else {
            console.log(chalk.green('No Setup'));
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


//TODO
program
    .command('getStatistics')
    .description('Get Time Limit Statistics ')
    .option('-s, --startMonth [startMonth]', 'Starting Month Numeric')
    .option('-e, --endMonth [endMonth] ', 'Ending Month Numeric')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {

            console.log(options.startMonth);
            console.log(options.endMonth);

            let groupByCategory, groupByDate, groupByNbrArtifacts, uniqueUsers ;


            if (
                options.hasOwnProperty('startMonth') &&
                options.startMonth &&
                !isNaN(options.startMonth) &&
                parseInt(options.startMonth) >= 1 &&
                parseInt(options.startMonth) <= 12 &&
                options.hasOwnProperty('endMonth') &&
                options.endMonth &&
                !isNaN(options.endMonth) &&
                parseInt(options.endMonth) >= 1 &&
                parseInt(options.endMonth) <= 12
            ) {
                Promise.all([
                    mongoService.getCategories(),
                    mongoService.getExhibitionsForTimeLimit( 'publishedAt' , options.startMonth , options.endMonth , '2020')
                ])
                    .then(( [ categories , exhibitions] ) => {

                        console.log(categories);
                        console.log(exhibitions.length);

                        let allUsers = exhibitions.reduce((r, a) => {
                            r.allUsers = [ ...r.allUsers || [] , a.user]
                            return r;
                        }, {});
                        uniqueUsers = allUsers.allUsers.filter((user , index , self) => {
                            return self.indexOf(user) === index;
                        })


                        groupByCategory = exhibitions.reduce((r, a) => {
                            a.categories.forEach((categoryId) => {
                                r[categoryId] = [...r[categoryId] || [], a]
                            });
                            return r;
                        }, {});
                        groupByDate = exhibitions.reduce((r, a) => {
                            const publishedDate = a.publishedAt.getDate() + '/' + ( a.publishedAt.getMonth() + 1 );
                            r[publishedDate] = [...r[publishedDate] || [], a];
                            return r;
                        }, {});

                        groupByNbrArtifacts = exhibitions.reduce((r, a) => {
                            let artifactSum;
                            if (a.model.artifacts.length < 30) {
                                artifactSum = 'small';
                            } else if ( a.model.artifacts.length < 80 ) {
                                artifactSum = 'medium';
                            } else {
                                artifactSum = 'big';
                            }
                            r[artifactSum] = [...r[artifactSum] || [], a];
                            return r;
                        }, {});

                        // console.log(Object.keys(groupByCategory));
                        // console.log(Object.keys(groupByDate));
                        // console.log(Object.keys(groupByNbrArtifacts));

                        // console.log(allUsers);
                        console.log(uniqueUsers);

                        return mongoService.getUsersByID(uniqueUsers)
                    })
                    .then(( users )=> {

                        console.log(users);

                        // if ( options.hasOwnProperty('json') && options.json === true ) {
                        //     console.log(JSON.stringify(exhibitionsList) )
                        // } else {
                        //     console.log(exhibitionsList.length)
                        // }
                    })
                    .finally(() => {
                        mongoService.closeDB();
                    })
            } else {
                console.log(chalk.red('Wrong Arguments'));
            }

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
    .command('getPrivateSpaces')
    .description('Get All Private Spaces on Environment')
    .option('-s, --saveFile', 'Save to specific File')
    .option('-j, --json ', 'Export to JSON data')
    .option('-c, --csv ', 'Export to CSV data')
    .option('-p, --pretty ', 'Pretty print data')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {
            mongoService.getSpaces()
                .then((spaces) => {
                    if (options.hasOwnProperty('saveFile') && options.saveFile === true) {
                        if ( options.hasOwnProperty('csv') && options.csv === true) {
                            return Promise.all([
                                exportsService.saveFile( JSON.stringify(spaces) , 'csv' , 'spaces.' + 'csv' ) ,
                            ])
                        } else {
                            return Promise.all([
                                exportsService.saveFile( JSON.stringify(spaces) , 'json' , 'subscribers.' + 'json' ) ,
                            ])
                        }
                    } else {
                        if (options.hasOwnProperty('pretty') && options.pretty === true) {
                            console.log(chalk.blue('Found ' + spaces.length + ' Private Spaces'));
                            spaces.forEach((space) => {
                                let spaceText = chalk.blue(space.subdomain) + ' : ';
                                if ( space.isActive ) {
                                    spaceText = spaceText + chalk.green('Active');
                                } else {
                                    spaceText = spaceText + chalk.red('inActive');
                                }
                                console.log(spaceText)
                            })
                        } else {
                            console.log(JSON.stringify(spaces) )
                        }
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
    .command('getPrivateSpace')
    .description('Get Details of a Private Spaces on Environment')
    .option('-s, --subdomain [subdomain]', 'Private Space subdomain')
    .option('-i, --info', 'Private Space Info')
    .option('-u, --users ', 'Private Space Users')
    .option('-j, --json ', 'Export to JSON data')
    .option('-c, --csv ', 'Export to CSV data')
    .option('-p, --pretty ', 'Pretty print data')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {
            if (options.hasOwnProperty('subdomain') && options.subdomain.length > 0) {
                const privateSpace = {};
                const needUsers = options.hasOwnProperty('users') && options.users === true;
                mongoService.getSpaces( options.subdomain )
                    .then((spaces) => {
                        if (spaces.length === 0) {
                            throw chalk.red('Private space with subdomain ' + options.subdomain + ' wasnt found!');
                        } else {
                            privateSpace.info = spaces[0];
                            if ( needUsers ) {
                                return mongoService.getUsers([] , privateSpace.info._id );
                            } else {
                                return Promise.resolve([]);
                            }
                        }
                    })
                    .then((users) => {
                        privateSpace.users = users;

                        if (options.hasOwnProperty('saveFile') && options.saveFile === true) {
                            if ( options.hasOwnProperty('csv') && options.csv === true) {
                                return Promise.all([
                                    ...Object.keys(privateSpace)
                                        .map(
                                            (key) => exportsService.saveFile( JSON.stringify(privateSpace[key]) , 'csv' , key + '.' + 'csv' )
                                        )
                                ])
                            } else {
                                return Promise.all([
                                    ...Object.keys(privateSpace)
                                        .map(
                                            (key) => exportsService.saveFile( JSON.stringify(privateSpace[key]) , 'json' , key + '.' + 'json' )
                                        )
                                ])
                            }
                        } else {
                            if (options.hasOwnProperty('pretty') && options.pretty === true) {
                                console.log('Title : ' + chalk.blue(privateSpace.info.title))
                                console.log('Description : ' + chalk.blue(privateSpace.info.description))
                                console.log('SubTitle : ' + chalk.blue(privateSpace.info.subtitle))
                                if (privateSpace.info.hasOwnProperty('isActive') && privateSpace.info.isActive) {
                                    console.log('Status : ' + chalk.green('Is Active'));
                                } else {
                                    console.log('Status : ' + chalk.red('Is Not Active'));
                                }
                                if (privateSpace.info.hasOwnProperty('templates')) {
                                    console.log('Templates : ' + chalk.blue(privateSpace.info.templates.length + ' Templates'))
                                }

                                if (needUsers) {
                                    console.log('Users : ' + chalk.blue(privateSpace.users.length) + chalk.green(' Registered Users') );
                                }

                            } else {
                                console.log(JSON.stringify(privateSpace) )
                            }
                        }

                    })
                    .catch((err) => {
                        console.log(err);
                    })
                    .finally(() => {
                        mongoService.closeDB();
                    })
            }

        }

    });

program
    .command('getCountExhibitions')
    .description('Get Count of Exhibitions Exchibitions ')
    .option('-u, --userEmail [userEmail]', 'User\'s  email')
    .option('-y, --year [year]', 'Limit for Specific Year')
    .option('-g, --groupBy [groupBy]', 'Field to Group By')
    .option('-j, --json ', 'Export to JSON data')
    .action( ( options ) => {

        if (settingsService.checkSettings()) {
            let exhibitionPromise;
            if ( options.hasOwnProperty('userEmail') && options.userEmail.length > 0) {
                exhibitionPromise = mongoService.getUsers([options.userEmail])
                    .then((userList) => {
                        return mongoService.getExhibitions(userList[0]._id)
                    })
            } else if ( options.hasOwnProperty('year') && options.year.length > 0){
                exhibitionPromise = mongoService.getExhibitionsForTimeLimit( 'createdAt' , '1' , '12' , options.year)
            } else {
                exhibitionPromise = mongoService.getExhibitions();
            }
            exhibitionPromise
                .then(( exhibitionsList )=> {
                    if (options.hasOwnProperty('groupBy') && options.groupBy.length > 0) {
                        return mongoService.getCategories()
                            .then((categoriesList) => {
                                let groupByCategory = exhibitionsList.reduce((r, a) => {
                                    a.categories.forEach((categoryId) => {
                                        r[categoryId] = [...r[categoryId] || [], a]
                                    });
                                    return r;
                                }, {});

                                let categoriesUsed = Object.keys(groupByCategory);
                                const grouped = {};
                                categoriesUsed.forEach((catID) => {
                                    let catName = categoriesList.find(cat => cat._id == catID).title;
                                    grouped[catName] = groupByCategory[catID];
                                })

                                return Promise.resolve(grouped);
                            })

                    } else {
                        return Promise.resolve(exhibitionsList);
                    }
                })
                .then((exhibitionsList) => {
                    if ( options.hasOwnProperty('json') && options.json === true ) {
                        console.log(JSON.stringify(exhibitionsList) )
                    } else {
                        if (Array.isArray(exhibitionsList)) {
                            console.log(exhibitionsList.length)
                        } else {
                            const groupKeys = Object.keys(exhibitionsList);
                            groupKeys.forEach((key) => {
                                console.log(key + '   =   ' + exhibitionsList[key].length);
                            })
                        }
                    }
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

