var stream = require('stream'),
    map    = require("through2-map"),
    moment = require('moment');

var RevisionStreamHelper = require_src('tasks/helpers/revision_stream_helper'),
    vcsSupport           = require_src('vcs_support'),
    pp                   = require_src('parallel_processing'),
    utils                = require_src('utils');

describe('RevisionStreamHelper', function() {
  beforeEach(function() {
    this.mockVcs = jasmine.createSpyObj('vcs adapter', ['revisions', 'showRevisionStream']);
    spyOn(vcsSupport, 'adapter').and.returnValue(this.mockVcs);

    this.subject = new RevisionStreamHelper({
      repository: { rootPath: 'repo_root' }
    }, 'jobRunner');
  });

  describe('.revisionAnalysisStream()', function() {
    var analyserFn = function() {
      return map.obj(function(obj) {
        return { result: obj.analysis + '-result' };
      });
    };

    beforeEach(function() {
      this.mockVcs.revisions.and.returnValue(['revision1', 'revision2']);

      this.mockStreamCollector = jasmine.createSpyObj('objectStreamCollector', ['mergeAll']);
      spyOn(pp, 'objectStreamCollector').and.returnValue(this.mockStreamCollector);
    });

    it('creates a vcs Adapter object with the repository root', function() {
      expect(vcsSupport.adapter).toHaveBeenCalledWith('repo_root');
    });

    it('returns the stream aggregate of all the revisions', function() {
      spyOn(utils.arrays, 'arrayToFnFactory').and.returnValue('revisions');
      this.mockStreamCollector.mergeAll.and.returnValue('final stream');

      expect(this.subject.revisionAnalysisStream('/test/file', 'date-range')).toEqual('final stream');

      expect(this.mockVcs.revisions).toHaveBeenCalledWith('/test/file', 'date-range');
      expect(utils.arrays.arrayToFnFactory).toHaveBeenCalledWith(['revision1', 'revision2'], jasmine.any(Function));
      expect(this.mockStreamCollector.mergeAll).toHaveBeenCalledWith('revisions');
    });

    it('collects an analysis result stream for each individual revision', function(done) {
      var streamAnalysisFn;
      spyOn(utils.arrays, 'arrayToFnFactory').and.callFake(function(revisions, fn) {
        streamAnalysisFn = fn;
      });

      var revisionStream = new stream.PassThrough({ objectMode: true });
      this.mockVcs.showRevisionStream.and.returnValue(revisionStream);

      this.subject.revisionAnalysisStream('/test/file', 'date-range', analyserFn);
      streamAnalysisFn({ revisionId: '123', date: '2014-01-31' })
        .on('data', function(obj) {
          expect(obj.revision).toEqual('123');
          expect(obj.date.isSame(moment('2014-01-31'), 'day')).toBeTruthy();
          expect(obj.result).toEqual('123-test-analysis-result');
        })
        .on('end', done);

      revisionStream.write({ analysis: '123-test-analysis' });
      revisionStream.end();
    });
  });
});
