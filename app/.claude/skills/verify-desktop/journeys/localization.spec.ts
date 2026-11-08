import {expect,test} from '@playwright/test';
import {bootApp,Evidence,installMockBridge} from './_support';

test('language switching, saved preference and Korean message preserve the user workflow',async({page},testInfo)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{if(!localStorage.getItem('buzz.locale.v1'))localStorage.setItem('buzz.locale.v1','en');});
 await installMockBridge(page);await bootApp(page);const evidence=new Evidence(page,testInfo,'localization');
 await page.getByTestId('channel-random').click();
 const draft='작성 중인 한글 메시지와 Alice';await page.getByTestId('message-input').fill(draft);
 await page.getByTestId('open-settings').click();await page.getByTestId('profile-popover-settings').click();await page.getByTestId('settings-nav-appearance').click();
 const picker=page.getByTestId('interface-language');await expect(picker).toHaveValue('en');await picker.selectOption('ko');
 await expect(page.locator('html')).toHaveAttribute('lang','ko');
 await expect(page.getByTestId('settings-nav-profile')).toHaveAccessibleName('프로필');
 await expect(page.getByTestId('language-settings')).toContainText('언어');
 await evidence.capture('korean-settings','selected Korean in real settings',page.getByTestId('settings-view'));
 await picker.selectOption('en');await expect(page.getByTestId('settings-nav-profile')).toHaveAccessibleName('Profile');
 await picker.selectOption('ko');await page.getByTestId('settings-back-to-app').click();
 await page.getByTestId('channel-random').click();await expect(page.getByTestId('message-input')).toHaveText(draft);
 await page.getByTestId('send-message').click();await expect(page.getByTestId('message-timeline')).toContainText(draft);
 await page.reload();await expect(page.getByTestId('app-sidebar')).toBeVisible();await expect(page.locator('html')).toHaveAttribute('lang','ko');
 await expect.poll(()=>page.evaluate(()=>localStorage.getItem('buzz.locale.v1'))).toBe('ko');
 await page.getByTestId('channel-random').click({button:'right'});
 const menu=page.locator('[role="menu"][data-state="open"]').first();await expect(menu).toBeVisible();
 await evidence.capture('korean-channel-menu','right-click random after reload',menu);await page.keyboard.press('Escape');
 await page.setViewportSize({width:800,height:700});
 await page.getByTestId('open-settings').click();await page.getByTestId('profile-popover-settings').click();await page.getByTestId('settings-nav-appearance').click();
 await expect(page.getByTestId('interface-language')).toBeVisible();await evidence.capture('narrow-settings','800px viewport in Korean',page.getByTestId('settings-view'));
 evidence.writeJson('language-state',await page.evaluate(()=>({lang:document.documentElement.lang,stored:localStorage.getItem('buzz.locale.v1')})));
 expect(errors).toEqual([]);
});

test.describe('Korean operating system default',()=>{
 test.use({locale:'ko-KR'});
 test('selects Korean without writing a preference',async({page})=>{
  await installMockBridge(page);await bootApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang','ko');
  expect(await page.evaluate(()=>localStorage.getItem('buzz.locale.v1'))).toBeNull();
 });
});
