@Library("nvdb-jenkins-assistant@main") _

node { checkout(scm).each { k, v -> env.setProperty(k, v) } }

def config
node { config = readYaml file: 'jenkins/config.yml' }

def params = [
    moduleRoot  : 'nvdb-finn-vegdata',
    refreshToken: config.credentials.refreshToken,
    iktlosning  : config.iktlosning
]

pipeline {
    agent any
    tools {
        nodejs 'node20'
    }
    environment {
        HTTP_PROXY = 'http://proxy.vegvesen.no:8080'
        HTTPS_PROXY = 'http://proxy.vegvesen.no:8080'
        VERSION = new Date().format("yyyy.MM.dd-${env.BUILD_NUMBER}")
        ATLAS_REFRESH_TOKEN_CREDENTIALS_ID = "${params.refreshToken}"
        IKT_LOSNING = "${params.iktlosning}"
    }
    stages {
        stage('Responsible user') {
            steps {
                retry(count: 2) { // add retry in case where responsibleUser() fails
                    script {
                        // if build is started manually we print the RESPONSIBLE USER
                        env.RESPONSIBLE_USER ? (echo("✅ Running with responsible user: ${env.RESPONSIBLE_USER}")) : (echo("⚠️ Responsible user not set manually, getting user from last commit... "))
                        env.RESPONSIBLE_USER ? (env.ATLAS_RESPONSIBLE_USER = env.RESPONSIBLE_USER) : (env.ATLAS_RESPONSIBLE_USER = responsibleUser())
                    }
                }
            }
        }
        stage('Setup') {
            steps {
                dir(params.moduleRoot) {
                    sh 'bun install'
                }
            }
        }
        stage('Build') {
            steps {
                dir(params.moduleRoot) {
                    sh 'bun run build'
                }
            }
        }
        stage('Package to Artrepo') {
            steps {
                dir(params.moduleRoot) {
                    withCredentials([usernamePassword(credentialsId: "artrepo", usernameVariable: 'ARTIFACTORY_USER', passwordVariable: 'ARTIFACTORY_TOKEN')]) {
                        sh 'bun run package'
                        sh 'bun run publish'
                    }
                }
            }
        }
        stage('Create image') {
            steps {
                withCredentials([string(credentialsId: params.refreshToken, variable: 'REFRESH_TOKEN')]) {
                    script {
                        env.ATLAS_CLIENT_REFRESH_TOKEN = "${REFRESH_TOKEN}"
                        sh "ac build nvdb-finn-vegdata -i ${IKT_LOSNING} -v ${VERSION} -b httpd24 -U https://artrepo.vegvesen.no/artifactory/webcontent-release-local/no/vegvesen/vt/nvdb/nvdb-finn-vegdata/nvdb-finn-vegdata-${VERSION}.tar.gz --non-interactive --allow-update --block-until-finished --responsible-user ${env.ATLAS_RESPONSIBLE_USER}"
                    }
                }
            }
        }
        stage('Tag commit') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE', message: '⚠️ Failed to tag commit') {
                    tagCommit version: "nvdb-finn-vegdata-${VERSION}"
                }
            }
        }
        stage('Deploy to Atlas') {
            steps {
                withCredentials([string(credentialsId: params.refreshToken, variable: 'REFRESH_TOKEN')]) {
                    script {
                        env.ATLAS_CLIENT_REFRESH_TOKEN = "${REFRESH_TOKEN}"
                        sh "cd atlas && ac deploy nvdb-finn-vegdata -i ${IKT_LOSNING} -e utv-1 --responsible-user ${env.ATLAS_RESPONSIBLE_USER}"
                    }
                }
            }
        }
    }
}
