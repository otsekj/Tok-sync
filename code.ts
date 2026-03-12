figma.showUI(__html__, { width: 340, height: 450 });

figma.clientStorage.getAsync('gh_token').then(token => {
  if (token) {
    figma.ui.postMessage({ type: 'token-loaded', token: token });
  }
});

async function walkAndApply(node: SceneNode, varMap: any) {
  // 1. Обработка Auto Layout (Paddings и Gaps)
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const layoutProps = ['paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'itemSpacing'];
    for (const prop of layoutProps) {
      const val = (node as any)[prop];
      if (typeof val === 'number' && val > 0) {
        let key = null;
        if (prop === 'itemSpacing') {
          key = varMap[`Gap/General/${val}`] || varMap[`Gap/${val}`];
        } else {
          key = varMap[`Padding/${val}`];
        }

        if (key) {
          try {
            const v = await figma.variables.importVariableByKeyAsync(key);
            node.setBoundVariable(prop as VariableBindableNodeField, v.id);
          } catch (e) { /* пропуск */ }
        }
      }
    }
  }

  // 2. Обработка Corner Radius (Скругления)
  if ("topLeftRadius" in node) {
    const radiusProps = ['topLeftRadius', 'topRightRadius', 'bottomLeftRadius', 'bottomRightRadius'];
    
    // Проверяем каждое свойство угла отдельно, так как Figma требует индивидуальной привязки
    for (const prop of radiusProps) {
      const val = (node as any)[prop];
      if (typeof val === 'number' && val > 0) {
        const key = varMap[`Radius/${val}`];
        if (key) {
          try {
            const v = await figma.variables.importVariableByKeyAsync(key);
            node.setBoundVariable(prop as VariableBindableNodeField, v.id);
          } catch (e) { /* пропуск */ }
        }
      }
    }
  }

  // Рекурсия по детям
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
        if (v && !v.remote) finalJson[v.name] = v.key;
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
    figma.notify("✨ Скругления и отступы синхронизированы!");
  }
};
