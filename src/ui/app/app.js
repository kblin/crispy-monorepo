'use strict';

(function() {
var app = angular.module('crispy', [
    'ngRoute',
    'crispy.input',
    'crispy.overview',
]);


app.config(['$routeProvider', function($routeProvider) {
    $routeProvider.otherwise({redirectTo: '/input'});
}]);

})();
