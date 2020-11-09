
const settingsService = require("../services/settings");
const filesService = require("../helpers/files");
const {MongoClient , ObjectId} = require('mongodb');
const chalk = require("chalk");
const url = settingsService.getSetting("mongoURL"); // "mongodb://localhost:27017/"
const dbName = settingsService.getSetting("dbName"); // "artsteps"
const client = new MongoClient(url, { useUnifiedTopology: true });
let connectedClient;



const test = () => {
    return connectDB()
        .then(( connectedClient) => {
            return listDatabases(connectedClient)
        })
        .then((dbs) => {
            console.log("Databases:");
            dbs.databases.forEach(db => console.log(` - ${db.name}`));
        })
        .catch((err) => {
            console.log(err);
        })
}

const getUsers = ( userMails = [] , privateSpaceID = '') => {
    let query = {};
    if (userMails.length) {
        query = Object.assign( query , {  'emails.0.address' : { $in: userMails } } )
    }
    if (privateSpaceID.length > 0) {
        query = Object.assign( query , { 'spaces' : privateSpaceID })
    }
    return connectDB()
        .then( (connectedClient) => {
            const db = connectedClient.db(dbName);
            return db.collection('users')
                .find( query )
                .toArray();
        })
        .then( (usersObjects ) => {
            usersObjects.sort( (a, b) => {
                const A = a.emails[0].address, B = b.emails[0].address;
                if (userMails.indexOf(A) > userMails.indexOf(B)) {
                    return 1;
                } else {
                    return -1;
                }
            });
            return Promise.resolve(usersObjects);
        })
        .catch((err) => {
            console.log(err);
        })
}

const getSpaces = ( subdomain ) => {
    let query = {};
    if (subdomain) {
        query = { subdomain : subdomain }
    }
    return connectDB()
        .then( (connectedClient) => {
            const db = connectedClient.db(dbName);
            return db.collection('spaces')
                .find( query )
                .toArray();
        })
        .catch((err) => {
            console.log(err);
        })
}

const getSubscribers = () => {
    return connectDB()
        .then( (connectedClient) => {
            const db = connectedClient.db(dbName);
            return db.collection('subscribers')
                .find( {} )
                .toArray();
        })
        .catch((err) => {
            console.log(err);
        })
}

const getExhibitions = ( userID ) => {
    let query = {};
    if (userID) {
        query = { user : userID }
    }

    return connectDB()
        .then( (connectedClient) => {
            const db = connectedClient.db(dbName);
            return db.collection('exhibitions')
                .find( query )
                .toArray();
        })
        .catch((err) => {
            console.log(err);
        })

}

const getExhibition = ( exhibitionIdentifier , byID = true ) => {
    let query = {};

    if (exhibitionIdentifier) {
        if ( byID ) {
            query = { _id : ObjectId(exhibitionIdentifier) }
        } else {
            query = { title : exhibitionIdentifier }
        }
    }

    return connectDB()
        .then( (connectedClient) => {
            const db = connectedClient.db(dbName);
            return db.collection('exhibitions')
                .find( query )
                .toArray();
        })
        .catch((err) => {
            console.log(err);
        })

}

const cloneExhibition = ( exhibitionObject , oldUserID , newUserID , newExhibitionName ) => {

    console.log(oldUserID);
    console.log(newUserID);
    const filesToCopy = {};
    const idsMap = {};
    return connectDB()
        .then( (connectedClient) => {
            const db = connectedClient.db(dbName);
            const newExpId = new ObjectId();
            exhibitionObject._id = newExpId;
            exhibitionObject.user = newUserID;
            if (newExhibitionName && newExhibitionName.length > 0) {
                exhibitionObject.title = newExhibitionName;
            }
            exhibitionObject.createdAt = Date.now();
            exhibitionObject.publishedAt = Date.now();

            if (exhibitionObject.hasOwnProperty('published')) {
                delete exhibitionObject.published;
                delete exhibitionObject.publishedAt;
            }

            if (exhibitionObject.hasOwnProperty('staffPick')) {
                exhibitionObject.staffPick = false;
            }

            if (exhibitionObject.hasOwnProperty('image') && exhibitionObject.image.hasOwnProperty('file')) {
                let newFileName = exhibitionObject.image.file.split('_');
                newFileName[1] = newExpId;
                filesToCopy[ exhibitionObject.image.file ] = newFileName.join('_');
                exhibitionObject.image.file = newFileName.join('_');
            }

            const artifactIDs = exhibitionObject.model.artifacts.map(artifactRef => artifactRef.artifact);
            const wallsToBeModified = [];
            let uniqueRemoteUrls = [];
            let uniqueCustomTextures = [];
            exhibitionObject.model.walls.forEach((wall) => {
                if ( wall.textureBack.startsWith('/api/') ) {
                    wallsToBeModified.push(wall);
                    uniqueCustomTextures.push(wall.textureBack.split('/')[3])

                } else if ( wall.textureBack.length > 0 ) {
                    uniqueRemoteUrls.push(wall.textureBack);
                }
                if ( wall.textureFront.startsWith('/api/') ) {
                    wallsToBeModified.push(wall);
                    uniqueCustomTextures.push(wall.textureFront.split('/')[3])

                } else if ( wall.textureFront.length > 0 ) {
                    uniqueRemoteUrls.push(wall.textureFront);
                }
            })

            uniqueRemoteUrls = uniqueRemoteUrls.filter((el , idx, arr) => {
                return arr.indexOf(el) === idx
            })
            uniqueCustomTextures = uniqueCustomTextures.filter((el , idx, arr) => {
                return arr.indexOf(el) === idx
            })

            return db.collection('artifacts')
                .find( {  '_id' : { $in: artifactIDs } })
                .toArray()
                .then((savedArtifacts) => {

                    savedArtifacts.sort( (a, b) => {
                        const A = a._id, B = b._id;
                        if (artifactIDs.indexOf(A) > artifactIDs.indexOf(B)) {
                            return 1;
                        } else {
                            return -1;
                        }
                    });

                    savedArtifacts.forEach((savedArtifact) => {
                        const newArtifactId = new ObjectId();
                        idsMap[savedArtifact._id] = newArtifactId;

                        savedArtifact._id = newArtifactId;
                        savedArtifact.user = newUserID;
                        savedArtifact.createdAt = Date.now();
                        savedArtifact.publishedAt = Date.now();

                        if (savedArtifact.hasOwnProperty('image') && savedArtifact.image.hasOwnProperty('file')) {
                            let newFileName = savedArtifact.image.file.split('_');
                            newFileName[1] = newArtifactId;
                            newFileName = newFileName.join('_');
                            filesToCopy[ savedArtifact.image.file ] = newFileName;
                            savedArtifact.image.file = newFileName;
                        }

                        if (savedArtifact.hasOwnProperty('audio') && savedArtifact.audio.hasOwnProperty('file')) {
                            let newFileName = savedArtifact.audio.file.split('_');
                            newFileName[1] = newArtifactId;
                            newFileName = newFileName.join('_');
                            filesToCopy[ savedArtifact.audio.file ] = newFileName;
                            savedArtifact.audio.file = newFileName;
                        }

                        if (
                            savedArtifact.type === 'image' &&
                            savedArtifact.hasOwnProperty('files') &&
                            savedArtifact.files.length > 0
                        ) {
                            if (
                                savedArtifact.files[0].hasOwnProperty('file') &&
                                savedArtifact.files[0].file.length > 0
                            ) {
                                let newFileName = savedArtifact.files[0].file.split('_');
                                newFileName[1] = newArtifactId;
                                newFileName = newFileName.join('_');
                                filesToCopy[ savedArtifact.files[0].file ] = newFileName;
                                savedArtifact.files[0].file = newFileName;
                            }
                        }

                    })

                    return db.collection('artifacts')
                        .insertMany(savedArtifacts);
                })
                .then((successInsert) => {
                    if (successInsert.hasOwnProperty('opts')) {
                        console.log(chalk.green('Copied ' + successInsert.opts.length + ' Artifacts along'));
                    }
                    exhibitionObject.model.artifacts.forEach((artifactRef , index) => {
                        artifactRef._id = new ObjectId();
                        artifactRef.artifact = idsMap[ artifactRef.artifact ];
                    })
                    return db.collection('textures')
                        .find( {
                            'user': newUserID,
                            "file.uri": { $in : uniqueRemoteUrls }
                        } )
                        .toArray();
                })
                .then((userRemoteTextures) => {


                    userRemoteTextures.sort( (a, b) => {
                        const A = a.file.uri, B = b.file.uri;
                        if (uniqueRemoteUrls.indexOf(A) > uniqueRemoteUrls.indexOf(B)) {
                            return 1;
                        } else {
                            return -1;
                        }
                    });

                    userRemoteTextures.forEach(remoteTexture => {
                        remoteTexture._id = new ObjectId();
                        remoteTexture.user = newUserID;
                        remoteTexture.createdAt = Date.now();
                        remoteTexture.publishedAt = Date.now();

                    })
                    if (userRemoteTextures.length > 0) {
                        return db.collection('textures')
                            .insertMany(userRemoteTextures);
                    } else {
                        return Promise.resolve({opts : []});
                    }
                })
                .then((successInsertRemoteTextures) => {
                    console.log(chalk.green('Copied ' + successInsertRemoteTextures.opts.length + ' Textures with Remote Urls along'));
                    return db.collection('textures')
                        .find( {
                            'user': newUserID,
                            '_id': { $in : uniqueCustomTextures }
                        } )
                })
                .then((userCustomTextures) => {


                    userCustomTextures.sort( (a, b) => {
                        const A = a._id, B = b._id;
                        if (uniqueCustomTextures.indexOf(A) > uniqueCustomTextures.indexOf(B)) {
                            return 1;
                        } else {
                            return -1;
                        }
                    });

                    userCustomTextures.forEach(customTexture => {
                        const oldID = customTexture._id;
                        customTexture._id = new ObjectId();
                        customTexture.user = newUserID;
                        customTexture.createdAt = Date.now();
                        customTexture.publishedAt = Date.now();

                        customTexture.image.bin.updatedAt = Date.now();
                        customTexture.image.bin.createdAt = Date.now();

                        wallsToBeModified.forEach((wall) => {
                            if (wall.textureFront.includes(oldID)) {
                                wall.textureFront.replace(oldID , customTexture._id);
                            }
                            if (wall.textureBack.includes(oldID)) {
                                wall.textureBack.replace(oldID , customTexture._id);
                            }
                        })
                    })
                    if (userCustomTextures.length > 0) {
                        return db.collection('textures')
                            .insertMany(userCustomTextures);
                    } else {
                        return Promise.resolve({opts : []});
                    }
                })
                .then((successInsertCustomTextures) => {
                    console.log(chalk.green('Copied ' + successInsertCustomTextures.opts.length + ' Textures with Custom Images along'));
                    if ( Object.keys(filesToCopy).length > 0) {
                        return filesService.copyUserFiles( oldUserID , newUserID , filesToCopy )
                            .then(() => {
                                console.log(chalk.green('Copied ' + Object.keys(filesToCopy).length + ' files from the old User Directory to the new User'));
                                return Promise.resolve(exhibitionObject);
                            })
                    } else {
                        return Promise.resolve(exhibitionObject);
                    }
                })
                .then((newExhibition) => {
                    console.log(newExhibition.user)
                    return db.collection('exhibitions')
                        .insertOne( newExhibition );
                })
        })
        .then((successfullInsert) => {
            return Promise.resolve(successfullInsert.ops[0])
        })
        .catch((err) => {
            console.log(err);
        })

}


const connectDB = () => {

    if (connectedClient) {
        return Promise.resolve(connectedClient);
    } else {
        return client.connect()
            .then((connectedclient) => {
                connectedClient = connectedclient;
                return Promise.resolve(connectedClient);
            })
    }
}

const closeDB = () => {
    client.close().then(() => {
        process.exit();
    });
}

const listDatabases = (client) => {
    return client.db().admin().listDatabases()
}


module.exports = {
    connectDB,
    closeDB ,
    test ,
    getExhibitions ,
    getExhibition ,
    getSpaces ,
    getUsers ,
    getSubscribers ,
    cloneExhibition
}
