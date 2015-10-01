'use strict';

(function(){

var app = angular.module('crispy.input', [
    'ngRoute',
]);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/input', {
    templateUrl: 'input/input.html',
    controller: 'InputController'
  });
}]);

app.controller('InputController', ['$scope', function($scope) {
    this.asID="";
    this.file="";

    this.sumbitForm = function(isValid) {
        console.log("told to sumbmit form");
    };
}]);

})();
