Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    tagPicker: null,

    items: [
        {
            xtype: 'container',
            itemId: 'widgets',
            columnWidth: 1
        },
        {
            xtype: 'container',
            itemId: 'gridContainer',
            columnWidth: 1
        }
    ],

    _artifactsWithTags: [],
    _artifactTagsGrid: null,
    _rallyServer: null,


    launch: function() {

        var me = this;

        this._getHostName();

        this.tagPicker = Ext.create('Rally.ui.picker.TagPicker', {
            itemId:'tagpicker',
            width: 300
        });

        this.down('#widgets').add(this.tagPicker);

        this.down('#widgets').add({
            xtype: 'rallybutton',
            text: 'Find Tagged Artifacts',
            handler: function() {
                me._getArtifacts();
            }
        });

    },

    _getHostName: function() {
        testUrl = window.location.hostname || "rally1.rallydev.com";
        testUrlSplit = testUrl.split("/");
        if (testUrlSplit.length === 1) {
            this._rallyHost = "rally1.rallydev.com";
        } else {
            this._rallyHost = testUrlSplit[2];
        }
        this._rallyServer = "https://" + this._rallyHost;
    },

    _getArtifacts: function() {

        var me = this;
        var selectedTagRecords = this.tagPicker._getRecordValue();

        if (selectedTagRecords.length > 0) {

            var myTagFilters = [];

            Ext.Array.each(selectedTagRecords, function(thisTag) {
                var thisTagName = thisTag.get('Name');
                var thisFilter = {
                    property: 'Tags.Name',
                    operator: 'contains',
                    value: thisTagName
                };
                myTagFilters.push(thisFilter);
            });

            Ext.create('Rally.data.wsapi.artifact.Store', {
                models: ['PortfolioItem/Pebble','HierarchicalRequirement','Defect','Task','TestCase'],
                fetch: ['ObjectID', 'FormattedID', 'Name', 'Project', 'Tags','Owner','UserName','DisplayName'],
                autoLoad: true,
                context: {
                    project: null
                },
                listeners: {
                    load: this._onDataLoaded,
                    scope: this
                },
                filters: Rally.data.wsapi.Filter.or(myTagFilters),
                limit: Infinity
            });
        }
    },

    _onDataLoaded: function(store, records) {
        var me = this;
        var promises = [];

        if (records.length === 0) {
            me._noArtifactsNotify();
        }

        Ext.Array.each(records, function(artifact) {
            promises.push(me._getArtifactTags(artifact, me));
        });

        Deft.Promise.all(promises).then({
            success: function(results) {
                me._artifactsWithTags = results;
                me._makeGrid();
            }
        });
    },

    _getArtifactTags: function(artifact, scope) {

        var deferred                = Ext.create('Deft.Deferred');
        var me                      = scope;

        var tags                    = [];

        var artifactRef             = artifact.get('_ref');
        var artifactObjectID        = artifact.get('ObjectID');
        var artifactFormattedID     = artifact.get('FormattedID');
        var artifactName            = artifact.get('Name');
        var artifactProject         = artifact.get('Project');
        var artifactScheduleState   = artifact.get('ScheduleState');
        var artifactOwnerObj        = artifact.get('Owner');
        var artifactType            = artifact.get('_type');

        if (artifactType === "hierarchicalrequirement") {
            artifactType = "userstory";
        }

        var artifactOwner               = "";
        if ( artifactOwnerObj !== null ) {
            artifactOwner           = artifactOwnerObj['DisplayName'];
        }

        var tagsCollection          = artifact.getCollection("Tags", {fetch: ['Name', 'ObjectID']});
        var tagCount                = tagsCollection.getCount();

        tagsCollection.load({
            callback: function(records, operation, success) {
                Ext.Array.each(records, function(tag) {
                    tags.push(tag);
                });
                result = {
                    "_ref"          : artifactRef,
                    "ObjectID"      : artifactObjectID,
                    "FormattedID"   : {"FormattedID": artifactFormattedID, "ObjectID": artifactObjectID, "Type": artifactType},
                    "Name"          : artifactName,
                    "Project"       : artifactProject._refObjectName,
                    "Owner"         : artifactOwner,
                    "Tags"          : tags
                };
                deferred.resolve(result);
            }
        });

        return deferred;
    },

    _makeGrid: function() {
        var me = this;

        if (me._artifactTagsGrid) {
            me._artifactTagsGrid.destroy();
        }

        var gridStore = Ext.create('Rally.data.custom.Store', {
            data: me._artifactsWithTags,
            groupField: 'Project',
            pageSize: 50,
            remoteSort: false
        });

        var formattedIdTemplate = "<a href='{0}/#/detail/{1}/{2}' target='_blank'>{3}</a>";

        me._artifactTagsGrid = Ext.create('Rally.ui.grid.Grid', {
            itemId: 'artifactGrid',
            store: gridStore,
            features: [
                {
                    ftype:'groupingsummary',
                    startCollapsed: true
                }
            ],
            columnCfgs: [
                {
                    text: 'Project', dataIndex: 'Project', flex: 1
                },
                {
                    text: 'Formatted ID', dataIndex: 'FormattedID',
                    renderer: function(value) {
                        return Ext.String.format(formattedIdTemplate, me._rallyServer, value.Type, value.ObjectID, value.FormattedID);
                    }
                },
                {
                    text: 'Name', dataIndex: 'Name', flex: 1
                },
                {
                    text: 'Owner', dataIndex: 'Owner', flex: 1,
                    renderer: function(value) {
                        if (value !== null) {
                            return value;
                        }
                    }
                },
                {
                    text: 'Tags', dataIndex: 'Tags',
                    renderer: function(values) {
                        var tagArray = [];
                        Ext.Array.each(values, function(tag) {
                            var tagName = tag.get('Name');
                            tagArray.push(tagName);
                        });
                        return tagArray.join(', ');
                    },
                    flex: 1
                }
            ]
        });

        me.down('#gridContainer').add(me._artifactTagsGrid);
        me._artifactTagsGrid.reconfigure(gridStore);
    },


    _noArtifactsNotify: function() {
        this._artifactTagsGrid = this.down('#gridContainer').add({
            xtype: 'container',
            html: "No Artifacts found matching selected Tags."
        });
    }
 });