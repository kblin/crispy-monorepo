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

    var vm = this;

    $scope.targetTooltip = "You can select the target to predict CRISPR sequences for " +
        "by either specifying a range (1234-5678), a locus tag (SCO4711), " +
        "or an antiSMASH-predicted gene cluster (cluster 3)";


    vm.target = "";
    vm.selectTarget = selectTarget;
    vm.session = {state: 'pending'};
    vm.typeahead = [];
    vm.cluster_names = [];
    vm.orf_names = [];
    var genome = Genome.get({id: $stateParams.id}, getGenome);


    var stop = undefined;

    function selectTarget(name) {
        this.target = name;
    };

    function getClusterNames(genome) {
        var clusters = [];
        for (var i in genome.clusters) {
            clusters.push(genome.clusters[i].name);
        };
        return clusters;
    }

    function getOrfNames(genome) {
        var orfs = [];
        for (var i in genome.orfs) {
            orfs.push(genome.orfs[i].id);
        };
        return orfs;
    }

    function getGenome() {
        console.log(genome);

        function update() {
            genome = Genome.get({id: $stateParams.id}, getGenome)
        };

        if (genome.state == 'pending') {
            stop = $timeout(update, 50000);
            return;
        }
        if (genome.state == 'loaded') {
            vm.session = genome;
            vm.cluster_names = getClusterNames(genome.genome);
            vm.orf_names = getOrfNames(genome.genome);
            vm.typeahead = vm.cluster_names.concat(vm.orf_names);
        }
    }

}]);

})();

