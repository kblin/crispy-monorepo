'use strict';

(function(){

var app = angular.module('crispy.overview', [
    'ui.router',
    'ngResource',
]);

app.factory('Genome', ['$resource', function($resource) {
    return $resource('/api/v1.0/genome/:id', {id: '@id'});
}]);

app.controller('OverviewController', ['$scope', '$state', '$stateParams', '$timeout', '$http', 'Genome',
  function($scope, $state, $stateParams, $timeout, $http, Genome) {

    var vm = this;

    $scope.targetTooltip = "You can select the target to predict CRISPR sequences for " +
        "by either specifying a range (1234-5678), a locus tag (SCO4711), " +
        "or an antiSMASH-predicted gene cluster (cluster 3)";


    vm.target = "";
    vm.selectTarget = selectTarget;
    vm.session = {state: 'pending'};
    vm.typeahead = [];
    vm.cluster_names = [];
    vm.orf_names = {};
    vm.submit = submit;
    var genome = Genome.get({id: $stateParams.id}, getGenome, handleError);


    var stop = undefined;

    function selectTarget(name) {
        this.target = name;
    };

    function submit() {
        var from = 0;
        var to = 0;
        if (vm.target.match(/Cluster \d+/)) {
            var clusters = vm.session.genome.clusters;
            for (var i in clusters) {
                if (clusters[i].name == vm.target) {
                    from = clusters[i].start;
                    to = clusters[i].end;
                    break;
                }
            }
        } else if (vm.target.match(/\d+\s*-\s*\d+/)) {
            var match = vm.target.match(/(\d+)\s*-\s*(\d+)/);
            from = match[1];
            to = match[2];
        } else {
            var orfs = vm.session.genome.orfs;
            if (vm.orf_names[vm.target] !== undefined) {
                var i = vm.orf_names[vm.target];
                from = orfs[i].start;
                to = orfs[i].end;
            }
        }
        console.log(from, to);
        var id = $stateParams.id;
        $http.post('/api/v1.0/genome/'+id, {from: parseInt(from), to: parseInt(to)})
            .then(function(response) {
                console.log(response.data);
                $state.go('output', {id: id});
        });
    }

    function getClusterNames(genome) {
        var clusters = [];
        for (var i in genome.clusters) {
            clusters.push(genome.clusters[i].name);
        };
        return clusters;
    }

    function getOrfNames(genome) {
        var orfs = {}
        for (var i in genome.orfs) {
            var orf = genome.orfs[i];
            if (genome.orfs[i].protein_id !== undefined) {
                orfs[genome.orfs[i].protein_id] = i;
            }
            if (genome.orfs[i].locus_tag !== undefined) {
                orfs[genome.orfs[i].locus_tag] = i;
            }
            if (genome.orfs[i].gene !== undefined) {
                orfs[genome.orfs[i].gene] = i;
            }
        }
        return orfs;
    };

    function getGenome() {
        function update() {
            genome = Genome.get({id: $stateParams.id}, getGenome, handleError)
        };

        vm.session = genome;

        if (genome.state == 'pending') {
            stop = $timeout(update, 5000);
            return;
        }
        if (genome.state == 'scanning') {
            $state.go('output', {id: $stateParams.id});
            return;
        }
        if (genome.state == 'error') {
            console.log(genome);
            return;
        }
        if (genome.state == 'loaded') {
            vm.cluster_names = getClusterNames(genome.genome);
            vm.orf_names = getOrfNames(genome.genome);
            vm.typeahead = vm.cluster_names.concat(Object.keys(vm.orf_names));
        }
    }

    function handleError(response) {
        vm.session.state = 'error';
        if (response.status == 404) {
            vm.session.error_text = 'Session not found, please reupload data.';
            return;
        }
        if (response.status == 500) {
            vm.session.error_text = 'Server error';
            return;
        }
        vm.session.error_text = 'Unknown error';
        console.log(response);
    }

    $scope.$on('$destroy', function(){
        if (angular.isDefined(stop)) {
            $timeout.cancel(stop);
        }
    });
}]);

})();

