'use strict';

(function() {
var app = angular.module('crispy', [
    'ui.bootstrap',
    'ui.router',
    'crispy.input',
    'crispy.overview',
    'crispy.output',
]);


app.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/input');

    $stateProvider
        .state('input', {
            url: '/input',
            views: {
                main: {
                    templateUrl: 'input/input.html',
                    controller: 'InputController',
                },
                shopping: {},
                goback: {},
            }
        })
        .state('overview', {
            url: '/overview/:id',
            views: {
                main: {
                    params: {uri: null},
                    templateUrl: 'overview/overview.html',
                    controller: 'OverviewController',
                },
                goback: {},
                shopping: {},
            }
        })
        .state('output', {
            url: '/output/:id',
            views: {
                main: {
                    params: {uri: null},
                    templateUrl: 'output/output.html',
                    controller: 'OutputController',
                },
                shopping: {
                    templateUrl: 'output/cart.html',
                    controller: 'CartController',
                },
                goback: {
                    templateUrl: 'output/simple_back.html',
                },
            }
        })
        .state('download', {
            url: '/download/:id',
            views: {
                main: {
                    params: {uri: null},
                    templateUrl: 'output/download.html',
                    controller: 'DownloadController',
                    controllerAs: 'dl',
                },
                shopping: {},
                goback: {
                    templateUrl: 'output/simple_back.html'
                },
            }
        })
        .state('about', {
            url: '/about',
            views: {
                main: {
                    templateUrl: 'about.html',
                },
                shopping: {},
            }
        })
        .state('help', {
            url: '/help',
            views: {
                main: {
                    templateUrl: 'help.html',
                },
                shopping: {},
            }
        });
});

})();
