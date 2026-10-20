import escapeHtml from 'escape-html';
import 'material-design-icons-iconfont';

import globalize from 'lib/globalize';
import Dashboard from 'utils/dashboard';
import { getParameterByName } from 'utils/url';

function getNodeIcon(item) {
    if (item.IsFolder) return 'folder';
    if (item.MediaType === 'Video') return 'movie';
    if (item.MediaType === 'Audio') return 'audiotrack';
    if (item.Type === 'TvChannel') return 'live_tv';
    if (item.MediaType === 'Photo') return 'photo';
    if (item.MediaType === 'Book') return 'book';
    return null;
}

function getNodeInnerHtml(item) {
    let name = item.Name;
    if (item.Number) {
        name = item.Number + ' - ' + name;
    }
    if (item.IndexNumber != null && item.Type != 'Season') {
        name = item.IndexNumber + ' - ' + name;
    }
    const icon = getNodeIcon(item);
    let html = "<span class='editorNode'>";
    if (icon) {
        html += `<span class="material-icons metadataSidebarIcon ${icon}" aria-hidden="true"></span>`;
    }
    if (item.LockData) {
        html += '<span class="material-icons metadataSidebarIcon lock" aria-hidden="true"></span>';
    }
    html += escapeHtml(name);
    html += '</span>';
    return html;
}

/** A tree node: `id` and `label` (HTML), optional `isFolder`, `itemType`, `serverItemType`, `collectionType`. */
function createNode(node) {
    const li = document.createElement('li');
    li.className = 'libraryTree-node';
    li.dataset.id = node.id;
    li.setAttribute('role', 'treeitem');
    if (node.itemType) li.dataset.itemtype = node.itemType;
    if (node.serverItemType) li.dataset.serveritemtype = node.serverItemType;
    if (node.collectionType) li.dataset.collectiontype = node.collectionType;

    const row = document.createElement('div');
    row.className = 'libraryTree-row';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'libraryTree-toggle';
    toggle.tabIndex = -1;
    if (node.isFolder) {
        li.setAttribute('aria-expanded', 'false');
        toggle.innerHTML = '<span class="material-icons chevron_right" aria-hidden="true"></span>';
        toggle.setAttribute('aria-label', globalize.translate('ButtonMore'));
    } else {
        toggle.disabled = true;
    }

    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'libraryTree-label';
    label.innerHTML = node.label;

    row.append(toggle, label);
    li.append(row);
    return li;
}

function setChildren(parent, children) {
    parent.innerHTML = '';
    parent.append(...children);
}

function itemToNode(item) {
    return {
        id: item.Id,
        label: getNodeInnerHtml(item),
        isFolder: item.IsFolder,
        itemType: item.Type,
        serverItemType: item.Type,
        collectionType: item.CollectionType
    };
}

function fetchChildren(li) {
    const id = li.dataset.id;
    if (id === 'MediaFolders') {
        return ApiClient.getJSON(ApiClient.getUrl('Library/MediaFolders')).then(result => result.Items.map(itemToNode));
    }
    if (id === 'livetv') {
        return ApiClient.getLiveTvChannels({ AddCurrentProgram: false }).then(result => result.Items.map(itemToNode));
    }
    const query = {
        ParentId: id,
        Fields: 'Settings',
        IsVirtualUnaired: false,
        IsMissing: false,
        EnableTotalRecordCount: false,
        EnableImages: false,
        EnableUserData: false
    };
    const itemType = li.dataset.itemtype;
    if (itemType != 'Season' && itemType != 'Series') {
        query.SortBy = 'SortName';
    }
    return ApiClient.getItems(Dashboard.getCurrentUserId(), query).then(result => result.Items.map(itemToNode));
}

/** Expands a folder node, loading its children on first open; resolves once they are rendered. */
function expand(li, state) {
    li.setAttribute('aria-expanded', 'true');
    let group = Array.from(li.children).find(child => child.classList.contains('libraryTree-group'));
    if (group) return Promise.resolve(group);

    group = document.createElement('ul');
    group.className = 'libraryTree-group';
    group.setAttribute('role', 'group');
    group.innerHTML = '<li class="libraryTree-loading">…</li>';
    li.append(group);

    return fetchChildren(li).then(nodes => {
        setChildren(group, nodes.map(createNode));
        return Promise.all(Array.from(group.children).map(child => restoreState(child, state)));
    }).then(() => group);
}

function collapse(li) {
    li.setAttribute('aria-expanded', 'false');
}

function select(tree, li) {
    tree.querySelector('.libraryTree-node.is-selected')?.classList.remove('is-selected');
    li.classList.add('is-selected');

    const itemType = li.dataset.itemtype;
    const sidebar = document.querySelector('.editPageSidebar');
    if (itemType === 'livetv' || itemType === 'mediafolders') {
        sidebar?.classList.remove('editPageSidebar-withcontent');
        return;
    }
    tree.dispatchEvent(new CustomEvent('itemclicked', {
        detail: {
            id: li.dataset.id,
            itemType,
            serverItemType: li.dataset.serveritemtype,
            collectionType: li.dataset.collectiontype
        },
        bubbles: true,
        cancelable: false
    }));
    sidebar?.classList.add('editPageSidebar-withcontent');
}

/** Re-opens the ancestors of the item being edited and marks it selected. */
function restoreState(li, state) {
    const id = li.dataset.id;
    if (id === state.selectedId) {
        li.classList.add('is-selected');
        setTimeout(() => li.scrollIntoView({ block: 'center' }), 0);
    }
    if (li.hasAttribute('aria-expanded') && state.openIds.includes(id)) {
        return expand(li, state);
    }
    return Promise.resolve();
}

function initializeTree(page, openIds, selectedId) {
    const tree = page.querySelector('.libraryTree');
    const state = { openIds: [ 'MediaFolders', ...openIds ], selectedId };
    const root = document.createElement('ul');
    root.className = 'libraryTree-root';
    root.setAttribute('role', 'tree');
    setChildren(tree, [ root ]);

    tree.onclick = e => {
        const li = e.target.closest('.libraryTree-node');
        if (!li || !tree.contains(li)) return;
        if (e.target.closest('.libraryTree-toggle')) {
            if (li.getAttribute('aria-expanded') === 'true') collapse(li);
            else expand(li, state);
            return;
        }
        select(tree, li);
    };

    ApiClient.getLiveTvChannels({ limit: 0 }).then(result => {
        const nodes = [ { id: 'MediaFolders', label: escapeHtml(globalize.translate('HeaderMediaFolders')), isFolder: true, itemType: 'mediafolders' } ];
        if (result.TotalRecordCount) {
            nodes.push({ id: 'livetv', label: escapeHtml(globalize.translate('LiveTV')), isFolder: true, itemType: 'livetv' });
        }
        setChildren(root, nodes.map(createNode));
        Array.from(root.children).forEach(li => {
            void restoreState(li, state);
        });
    });
}

let itemId;
export function setCurrentItemId(id) {
    itemId = id;
}

export function getCurrentItemId() {
    if (itemId) {
        return itemId;
    }
    return getParameterByName('id');
}

document.addEventListener('pagebeforeshow', e => {
    const page = e.target;
    if (!(page instanceof Element) || !page.classList.contains('metadataEditorPage')) return;

    import('../styles/metadataeditor.scss');
    Dashboard.getCurrentUser().then(user => {
        const id = getCurrentItemId();
        if (!id) {
            initializeTree(page, []);
            return;
        }
        ApiClient.getAncestorItems(id, user.Id).then(ancestors => {
            initializeTree(page, ancestors.map(i => i.Id), id);
        });
    });
});
