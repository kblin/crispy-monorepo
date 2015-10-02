'use strict';

(function() {
var app = angular.module('crispy', [
    'ui.bootstrap',
    'ui.router',
    'crispy.input',
    'crispy.overview',
]);


app.config(function($stateProvider, $urlRouterProvider) {
    $urlRouterProvider.otherwise('/input');

    $stateProvider
        .state('input', {
            url: '/input',
            templateUrl: 'input/input.html',
            controller: 'InputController',
        })
        .state('overview', {
            url: '/overview/:id',
            params: {uri: null},
            templateUrl: 'overview/overview.html',
            controller: 'OverviewController',
        });
});

})();
