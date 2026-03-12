figma.showUI(__html__, { width: 340, height: 450 });

figma.clientStorage.getAsync('gh_token').then(token => {
  if (token) {
    figma.ui.postMessage({ type: 'token-loaded', token: token });
  }
});

async function walkAndApply(node: SceneNode, varMap: any) {
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const props = ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'itemSpacing'];
    
    for (const prop of props) {
      const val = (node as any)[prop];
      if (val > 0) {
        let key = null;

        if (prop === 'itemSpacing') {
          // Для расстояний между элементами ищем ТОЛЬКО Gap
          key = varMap[`Gap/General/${val}`] || varMap[`Gap/${val}`];
        } else {
          // Для внутренних отступов ищем ТОЛЬКО Padding
          key = varMap[`Padding/${val}`];
        }

        if (key) {
          try {
            const v = await figma.variables.importVariableByKeyAsync(key);
            node.setBoundVariable(prop as VariableBindableNodeField, v.id);
          } catch (e) { console.error("Binding error:", e); }
        }
      }
    }
  }

  if ("children" in node) {
    for (const child of node.children) {
      await walkAndApply(child, varMap);
    }
  }
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'save-token') {
    await figma.clientStorage.setAsync('gh_token', msg.token);
    figma.notify("🔐 Токен сохранен");
  }

  if (msg.type === 'prepare-export') {
    const collections = await figma.variables.getLocalVariableCollectionsAsync();
    const finalJson: any = {};
    for (const col of collections) {
      for (const varId of col.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(varId);
        if (v && !v.remote) {
          finalJson[v.name] = v.key;
        }
      }
    }
    figma.ui.postMessage({ type: 'push-to-github', data: finalJson });
  }

  if (msg.type === 'apply-from-github') {
    if (figma.currentPage.selection.length === 0) {
      figma.notify("Выбери слой");
      return;
    }
    for (const node of figma.currentPage.selection) {
      await walkAndApply(node, msg.data);
    }
    figma.notify("✨ Готово!");
  }
};
