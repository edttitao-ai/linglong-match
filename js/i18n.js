/* 玲珑消 · i18n.js — 文案切换（沿用 zombie-crisis 的 data-i18n 约定） */
(function (global) {
  'use strict';
  const LL = (global.LL = global.LL || {});

  const I18N = {
    lang: 'zh',

    t(key, params) {
      const dict = (LL.LANG && LL.LANG[this.lang]) || {};
      let s = dict[key];
      if (s == null) s = (LL.LANG && LL.LANG.zh && LL.LANG.zh[key]) || key;
      if (params) {
        for (const k in params) {
          if (Object.prototype.hasOwnProperty.call(params, k)) {
            s = s.split('{' + k + '}').join(String(params[k]));
          }
        }
      }
      return s;
    },

    /* 取关卡名（按语言回退） */
    levelName(level) {
      if (!level) return '';
      if (this.lang === 'en' && level.nameEn) return level.nameEn;
      return level.name;
    },

    /* 关卡标题：每日挑战 / 无尽 / 限时都没有「第 N 关」前缀 */
    levelTitle(level) {
      if (!level) return '';
      if (level.endless) return this.t('endlessTitle') + ' · ' + this.t('stageLabel', { n: level.stage || 1 });
      if (level.timed) return this.t('timedTitle');
      if (level.daily) return this.t('dailyTitle') + ' · ' + this.levelName(level);
      return this.t('levelName', { n: level.id, name: this.levelName(level) });
    },

    /* 取基础块名 */
    tileName(color, lang) {
      const info = LL.CFG.TILE_INFO[color];
      if (!info) return '';
      return (lang || this.lang) === 'en' ? info.en : info.name;
    },

    setLang(lang) {
      this.lang = (LL.LANG && LL.LANG[lang]) ? lang : 'zh';
      if (typeof document !== 'undefined') {
        document.documentElement.lang = this.lang === 'en' ? 'en' : 'zh-CN';
        this.apply(document);
      }
    },

    /* 把 data-i18n / data-i18n-html / data-i18n-title 属性应用到 DOM */
    apply(root) {
      if (typeof document === 'undefined') return;
      const r = root || document;
      const list = r.querySelectorAll('[data-i18n]');
      for (let i = 0; i < list.length; i++) {
        list[i].textContent = this.t(list[i].getAttribute('data-i18n'));
      }
      const listHtml = r.querySelectorAll('[data-i18n-html]');
      for (let i = 0; i < listHtml.length; i++) {
        listHtml[i].innerHTML = this.t(listHtml[i].getAttribute('data-i18n-html'));
      }
      const listTitle = r.querySelectorAll('[data-i18n-title]');
      for (let i = 0; i < listTitle.length; i++) {
        listTitle[i].title = this.t(listTitle[i].getAttribute('data-i18n-title'));
      }
    }
  };

  LL.I18N = I18N;
})(typeof globalThis !== 'undefined' ? globalThis : this);
