/* Copyright 2012 Kai Blin. Licensed under the Apache License v2.0, see LICENSE file */

var svgene = {
    version: "0.1.5",
    label_height: 14,
    extra_label_width: 100,
    unique_id: 0
};
var memory = 0;
//2024/10/04 update
svgene.getgeneArrowDict = function (clusters, height, offset, border, scale) {
    var geneArrowDict = {}
  var top_ = offset + svgene.label_height + border;
  var bottom = offset + svgene.label_height + height - border;
  var middle = offset + svgene.label_height + (height/2);
  for (i = 0;i<clusters.length();i++){
      var cluster_ = clusters[i]
  if (cluster_.orf.strand == 1) {
      var start = scale(orf.start);
      var box_end = Math.max(scale(orf.end) - (2*border), start);
      var point_end = scale(orf.end);
      if(point_end>box_end){
          geneArrowDict.push(orf.name,1)
      }
  }
  if (cluster_.orf.strand == -1) {
      var point_start = scale(orf.start);
      var end = scale(orf.end);
      var box_start = Math.min(scale(orf.start) + (2*border), end);
      if(point_start<end){
          geneArrowDict.push(orf.name,-1)
      }

  }}
  return geneArrowDict;
};
//update end

//five points to ensure the towards of the cluster
svgene.geneArrowPoints = function (orf, height, offset, border, scale) {
  var top_ = offset + svgene.label_height + border;
  var bottom = offset + svgene.label_height + height - border;
  var middle = offset + svgene.label_height + (height/2);

  if (orf.strand == 1) {
      var start = scale(orf.start);
      var box_end = Math.max(scale(orf.end) - (2*border), start);
      var point_end = scale(orf.end);
      points  = "" + start + "," + top_;
      points += " " + box_end + "," + top_;
      points += " " + point_end + "," + middle;
      points += " " + box_end + "," + bottom;
      points += " " + start + "," + bottom;
      return points;
  }
  if (orf.strand == -1) {
      var point_start = scale(orf.start);
      var end = scale(orf.end);
      var box_start = Math.min(scale(orf.start) + (2*border), end);
      points = "" + point_start + "," + middle;
      points += " " + box_start + "," + top_;
      points += " " + end + "," + top_;
      points += " " + end + "," + bottom;
      points += " " + box_start + "," + bottom;
      return points;
  }
};


//2025-04-23Yang four points to draw the 5UTR's rectangle
svgene.gene5UTR = function (orf, height, offset, border, scale,width) {
      var top_ = offset + svgene.label_height + border;
      var bottom = offset + svgene.label_height + height - border;
      // var middle = offset + svgene.label_height + (height/2);


      if(orf.strand == 1){
          if(orf.start>=100){
        var start = scale(orf.start - 100);
        var box_end = Math.max(scale(orf.start) - (2*border), start);
        points  = "" + start + "," + top_;
        points += " " + box_end + "," + top_;
        points += " " + box_end + "," + bottom;
        points += " " + start + "," + bottom;
        return points;
          }else{return}
      }
      if(orf.strand == -1){
          if(orf.end+100<width){
              var end = scale(orf.end);
              var box_start = Math.max(scale(orf.end) + 100 + (2*border), end);
              points += " " + box_start + "," + top_;
              points += " " + end + "," + top_;
              points += " " + end + "," + bottom;
              points += " " + box_start + "," + bottom;
          }
      }


}

svgene.drawOrderedClusterOrfs = function(cluster, chart, all_orfs, ticks, scale,
                                         i, idx, height, width,
                                         single_cluster_height, offset) {
  chart.append("line")
    .attr("x1", 0)
    .attr("y1", (single_cluster_height * i) + svgene.label_height + (height/2))
    .attr("x2", width)
    .attr("y2", (single_cluster_height * i) + svgene.label_height + (height/2))
    .attr("class", "svgene-line");
    // 绘制额外的矩形框
  chart.selectAll("rect.extra-box")
    .data(all_orfs)
  .enter().append("rect")
    .attr("class", "svgene-extra-box")
    .attr("x", function(d) {
      if (d.strand == 1) {
        return scale(d.start-100) ; // 在前面加100bp的矩形框
      } else if (d.strand == -1) {
        return scale(d.end); // 在后面加100bp的矩形框
      }
    })
    .attr("y", function(d) {
      return (single_cluster_height * i) + svgene.label_height + offset;
    })
    .attr("width", 100/width)
    .attr("height", height - 2 * offset)
    .attr("fill", "grey"); // 设置矩形框的颜色
  chart.selectAll("polygon")
    .data(all_orfs)
  .enter().append("polygon")
    .attr("points", function(d) { return svgene.geneArrowPoints(d, height, (single_cluster_height * i), offset, scale); })

    .attr("class", function(d) { return "svgene-type-other svgene-orf"; })
    .attr("id", function(d) { return idx + "-cluster" + cluster.idx + "-" + svgene.tag_to_id(d.id) + "-orf"; })
    .attr("style", function(d) { if (d.color !== undefined) { return "fill:" + d.color; } });
  chart.selectAll("rect")
    .data(ticks, function(d) { return d.id })
  .enter().append("rect")
    .attr("x", function(d) { return scale(d.start); })
    .attr("y", function(d) { var offset = 0; if (d.strand == -1) { offset = height * 0.8; }; return (single_cluster_height * i) + svgene.label_height + offset; })
    .attr("height", 8)
    .attr("width", function(d) { return Math.max(scale(d.end - d.start), 5)})
    .attr("id", function(d) { return d.id + '-tick'; })
    .attr("class", "svgene-tick");
  chart.selectAll("text")
    .data(all_orfs)
  .enter().append("text")
    .attr("x", function(d) { return scale(d.start); })
    .attr("y", (single_cluster_height * i) + svgene.label_height + offset/2 - 5.5)
    .attr("class", "svgene-locustag")
    .attr("id", function(d) { return idx + "-cluster" + cluster.idx + "-" + svgene.tag_to_id(d.id) + "-label"; })
        .style("pointer-events", "none") // 确保文本不会被其他元素遮挡
  .style("z-index", 9999) // 确保文本位于最上层
    .text(function(d) { return d.id; });

};

svgene.drawUnorderedClusterOrfs = function(cluster, chart, all_orfs, ticks, scale,
                                           i, idx, height, width,
                                           single_cluster_height, offset) {
  chart.selectAll("rect")
    .data(all_orfs)
  .enter().append("rect")
    .attr("x", function(d) { return scale(d.start);})
    .attr("y", (single_cluster_height * i) + svgene.label_height + offset)
    .attr("height", height - (2 * offset))
    .attr("width", function(d) { return scale(d.end) - scale(d.start)})
    .attr("rx", 3)
    .attr("ry", 3)
    .attr("class", function(d) { return "svgene-type-other svgene-orf"; })
    .attr("id", function(d) { return idx + "-cluster" + cluster.idx + "-" + svgene.tag_to_id(d.id) + "-orf"; })
    .attr("style", function(d) { if (d.color !== undefined) { return "fill:" + d.color; } });
  chart.selectAll("text")
    .data(all_orfs)
  .enter().append("text")
    .attr("x", function(d) { return scale(d.start); })
    .attr("y", (single_cluster_height * i) + svgene.label_height + offset/2)
    .attr("class", "svgene-locustag")
    .attr("id", function(d) { return idx + "-cluster" + cluster.idx + "-" + svgene.tag_to_id(d.id) + "-label"; })
    .text(function(d) { return d.id; });
};

svgene.drawClusters = function(id, clusters, height, width, best_size, best_offset,if_tnpb) {
    // console.log("if_tnpb",if_tnpb);
  var container = d3.select("#" + id);
  var single_cluster_height = height + svgene.label_height;
  container.selectAll("svg").remove();
  container.selectAll("div").remove();
  var chart = container.append("svg")
    .attr("height", single_cluster_height * clusters.length)
    .attr("width", width + svgene.extra_label_width);
  var all_orfs = [];

  for (i=0; i < clusters.length; i++) {
      var cluster = clusters[i];
      all_orfs.push.apply(all_orfs, cluster.orfs);
      var ticks = cluster.ticks;
      var idx = svgene.unique_id++;
      var offset = height/10;
      var x = d3.scale.linear()
        .domain([cluster.start, cluster.end])
        .range([0, width]);
      if (cluster.unordered) {
          svgene.drawUnorderedClusterOrfs(cluster, chart, all_orfs, ticks, x,
                                          i, idx, height, width,
                                          single_cluster_height, offset);
      } else {
          svgene.drawOrderedClusterOrfs(cluster, chart, all_orfs, ticks, x,
                                        i, idx, height, width,
                                        single_cluster_height, offset);
      }
      container.selectAll("div")
        .data(all_orfs)
      .enter().append("div")
        .attr("class", "svgene-tooltip")
        .attr("id", function(d) { return idx + "-cluster" + cluster.idx + "-" + svgene.tag_to_id(d.id) + "-tooltip"; })
        .html(function(d) {

            return '<h5 style="position: relative; z-index: 10000000;">'+d.id+'</h5><a class="svgene-rescan" href="' + window.location.hash + '" id="' + svgene.tag_to_id(d.id) +
            '-rescan" data-from="' + d.start + '" data-to="' + d.end +'" data-size="' + best_size + '" data-offset="' + best_offset + '"data-flag="'+ if_tnpb +'" style="position: relative; z-index: 10000;">Show results for this gene only</a>'});
  }
  for (i=0; i < clusters.length; i++) {
      var cluster = clusters[i];
      if (cluster.label !== undefined) {
        chart.append("text")
            // .text(cluster.label)
            .attr("class", "svgene-clusterlabel")
            .attr("x", function() { return width + svgene.extra_label_width - this.getComputedTextLength() - 5})
            .attr("y", function() { return (single_cluster_height * i) + svgene.label_height })
            .attr("font-size", svgene.label_height);
      }
  }
  svgene.init();
};

svgene.tag_to_id = function(tag) {
    return tag.replace(/(:|\.)/g, '-').replace(/-orf/g, '_orf');
}


svgene.tooltip_handler = function(ev) {
    var id = $(this).attr("id").replace("-orf", "-tooltip");
    var tooltip = $("#"+id);

    if (svgene.active_tooltip) {
        svgene.active_tooltip.hide();
    }
    svgene.active_tooltip = tooltip;

    if (tooltip.css("display") == 'none') {
        var offset = $(this).offset();
        tooltip.css("left", offset.left + 10);
        var this_parent = $(this).parent();
        var top_offset = this_parent.height()/(this_parent.children('line').length * 2);
        tooltip.css("top", offset.top + top_offset);
        tooltip.show();
        tooltip.click(function(){$(this).hide()});
        var timeout = setTimeout(function(){ tooltip.slideUp("fast") }, 5000);
        tooltip.data("timeout", timeout);
        tooltip.mouseover(function() {
            clearTimeout(tooltip.data("timeout"));
        }).mouseout(function() {
            timeout = setTimeout(function(){ tooltip.slideUp("fast") }, 5000);
            tooltip.data("timeout", timeout);
        });
    } else {
        tooltip.hide();
    }
};


svgene.rescan = function(ev) {
    var from = parseInt($(this).attr('data-from'));
    var to = parseInt($(this).attr('data-to'));
    var best_size = parseInt($(this).attr('data-size'));
    var best_offset = parseInt($(this).attr('data-offset'));
    var flag = $(this).data('flag');
    var id = window.location.hash.split('/').pop();
    var uri = '/api/v1.0/genome/' + id;
    // console.log('from===============================',from)
    // console.log('to=================================',to)



    $.ajax({
        url: uri,
        method: 'POST',
        contentType: 'application/json',
        data: JSON.stringify({
            from: from,
            to: to,
            best_size: best_size,
            best_offset: best_offset,
            flag:flag,
        }),
        success: function(data) {

            var uri_components = window.location.hash.split('/');
            uri_components.pop();
            var new_uri = uri_components.join('/');
            window.open(new_uri + '/' + data.id, '_self');
        },
        error: function(xhr, status, error) {
        console.error("AJAX error:", {
            status: xhr.status,
            response: xhr.responseText,  // 服务器返回的错误信息
            error: error
        });
    },
        dataType: 'json',
    });

};

svgene.init = function() {
    $(".svgene-orf").mouseover(function(e) {
        var id = $(this).attr("id").replace("-orf", "-label");
        $("#"+id).show();
    }).mouseout(function(e) {
        var id = $(this).attr("id").replace("-orf", "-label");
        $("#"+id).hide();
    }).click(svgene.tooltip_handler);
    $(".svgene-rescan").click(svgene.rescan);
    $(".svgene-tick").mouseover(function(e) {
        var row = $(this).attr("id").replace("-tick", "-row");
        $("#"+row).addClass('tick-table-active');
        var class_str = $(this).attr('class') + ' active';
        $(this).attr('class', class_str);
        d3.select(this).toFront();
    }).mouseout(function(e) {
        var row = $(this).attr("id").replace("-tick", "-row");
        $("#"+row).removeClass('tick-table-active');
        var class_str = $(this).attr('class');
        class_str = class_str.replace(/ active/, '');
        $(this).attr('class', class_str);
    }).click(function(e) {
        var row = '#' + $(this).attr("id").replace("-tick", "-row");
        $(row).click();
    });
};
