'use strict';

(function(){

var app = angular.module('crispy.overview', [
    'ui.router',
    'ngResource',
]);

app.factory('Genome', ['$resource', function($resource) {
    return $resource('/api/v1.0/genome/:id', {id: '@id'});
}]);

app.controller('OverviewController', ['$scope', '$stateParams', '$timeout', 'Genome',
  function($scope, $stateParams, $timeout, Genome) {

    var genome = Genome.get({id: $stateParams.id}, getGenome);

    $scope.targetTooltip = "You can select the target to predict CRISPR sequences for " +
        "by either specifying a range (1234-5678), a locus tag (SCO4711), " +
        "or an antiSMASH-predicted gene cluster (cluster 3)";


    this.target = "";
    this.selectTarget = selectTarget;


    var stop = undefined;

    function selectTarget(name) {
        this.target = name;
    };

    function getGenome() {
        console.log(genome);

        function update() {
            genome = Genome.get({id: $stateParams.id}, getGenome)
        };

        if (genome.status == 'pending') {
            stop = $timeout(update, 50000);
            return;
        }
    }

}]);

})();

