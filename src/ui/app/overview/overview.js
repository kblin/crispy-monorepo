'use strict';

(function(){

var app = angular.module('crispy.overview', [
    'ngRoute',
    'ui.bootstrap',
]);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider.when('/overview', {
    templateUrl: 'overview/overview.html',
    controller: 'InputController'
  });
}]);

app.controller('OverviewController', ['$scope', function($scope) {
    this.clusters = [
    { start: 86637, end: 139654, name: "Cluster 1", description: "Leinamycin_biosynthetic_gene_cluster (2% of genes show similarity)"},
    { start: 166501, end: 192038, name: "Cluster 2", description: "Isorenieratene_biosynthetic_gene_cluster (100% of genes show similarity)"},
    { start: 235986, end: 271084, name: "Cluster 3", description: "Sanglifehrin_A_biosynthetic_gene_cluster (4% of genes show similarity)"},
    ];


    $scope.targetTooltip = "You can select the target to predict CRISPR sequences for " +
        "by either specifying a range (1234-5678), a locus tag (SCO4711), " +
        "or an antiSMASH-predicted gene cluster (cluster 3)";
}]);

})();

