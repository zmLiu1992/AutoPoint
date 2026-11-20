 function starCruiseNotify(subtitle = '', message = '') {
   $notification.post('[StarCruise] Bot', subtitle, message, {
     'url': ''
   });
 };

 function quickDisplay(result = '') {

   // 捷徑名稱（請先在捷徑 App 建一個同名捷徑）
   const shortcutName = "StarCruise顯示";

   // Shortcuts URL scheme（把 result 當作捷徑輸入）
   const url =
     "shortcuts://run-shortcut?name=" +
     encodeURIComponent(shortcutName) +
     "&input=" +
     encodeURIComponent(result);

   // 發一則可操作的通知：點了就打開捷徑並把值丟進去
   $notification.post(
     "[StarCruise] 分數查詢完成",
     "點擊這則通知以開啟捷徑，顯示完整結果",
     result, {
       action: "open-url", // 點通知後執行「開網址」
       url, // 這個網址就是上面的 shortcuts://...
       sound: true, //（可選）有提示音
       "auto-dismiss": 0 //（可選）0 代表不自動消失
     }
   );
 }

 
 const USERID_KEY = "StarCruise_UID";
 const USERPW_KEY = "StarCruise_PW";
 const LAST_POINT_KEY = "StarCruise_CP";

 function login(uid, pw, retried = false) {
   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: 'https://sdr.scstarnavigator.com/rwcapp/customer/session',
	   method: 'POST',
       body: JSON.stringify({
			id: uid,
			pin: pw
		  })
     };
	 
	 $httpClient.post(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('分數查詢失敗 ‼️', '連線錯誤，登入失敗');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const datas = JSON.parse(body);
			 const token = String(datas.token)
			 
             resolve(token);

           } catch (e) {
             starCruiseNotify('分數查詢失敗‼️', String(e));
             resolve(null);
           }
         } else {
           starCruiseNotify('分數查詢失敗 ‼️', `(${response.status}) 請重新查詢`);
           resolve(null);
         }
       }
     });
   });
 }

 function getPoint(token, retried = false) {
   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: 'https://sdr.scstarnavigator.com/rwcapp/customer/profile',
       headers: {
         'authorization': `Bearer ${token}`,
       }
     };

     $httpClient.get(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('分數查詢失敗 ‼️', '連線錯誤，取得 Profile 錯誤');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
             const datas = JSON.parse(body);
			 const earnCPpoint = parseFloat(datas.psn.bal[0].pointEarn);		 
    
             resolve(earnCPpoint);

           } catch (e) {
             starCruiseNotify('分數查詢失敗‼️', String(e));
             resolve(null);
           }
         } else {
           starCruiseNotify('分數查詢失敗 ‼️', `(${response.status}) 請重新查詢`);
           resolve(null);
         }
       }
     });
   });
 }
 
 function logout(token, retried = false) {
   return new Promise((resolve, reject) => {
     const requestUrl = {
       url: 'https://sdr.scstarnavigator.com/rwcapp/customer/session',
	   headers: {
         'authorization': `Bearer ${token}`,
       }
     };
	 
	 $httpClient.delete(requestUrl, function(error, response, body) {
       if (error) {
         starCruiseNotify('分數查詢失敗 ‼️', '連線錯誤，登出失敗');
         resolve(null);

       } else {
         if (response.status === 200) {
           try {
           
             resolve(null);

           } catch (e) {
             starCruiseNotify('分數查詢失敗‼️', String(e));
             resolve(null);
           }
         } else {
           starCruiseNotify('分數查詢失敗 ‼️', `(${response.status}) 請重新查詢`);
           resolve(null);
         }
       }
     });
   });
 }
 
 function getCurrentDateTime() {
   const now = new Date();

   const year = now.getFullYear();
   const month = String(now.getMonth() + 1).padStart(2, '0');
   const day = String(now.getDate()).padStart(2, '0');

   const hours = String(now.getHours()).padStart(2, '0');
   const minutes = String(now.getMinutes()).padStart(2, '0');
   const seconds = String(now.getSeconds()).padStart(2, '0');

   return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
 }

 

 class RetryError extends Error {
   constructor(message) {
     super(message);
     this.name = "RetryError";
   }
 }

 async function executeWithRetry(maxRetry = 1) {
   for (let attempt = 0; attempt <= maxRetry; attempt++) {
     console.log(`[Attempt ${attempt+1}/${maxRetry+1}] start`);

     try {
       await execute();
       return;
     } catch (e) {
       if (e && e.name === "RetryError" && attempt < maxRetry) {
         console.log(`[Retry] ${e.message} -> rerun execute()`);
         await sleep(800);
         continue;
       }
       throw e;
     }
   }
 }


 async function execute() {
   
   const userId = String($persistentStore.read(USERID_KEY));
   const userPw = String($persistentStore.read(USERPW_KEY));
   
   if (userId != null && userPw != null) {
	   const token = login(userId, userPw);
	   if (token != null) {
			const point = getPoint(token);
			if (point != null) {
               
			   const lastCP = parseFloat($persistentStore.read(LAST_POINT_KEY), 10);
			   
			   if (lastCP != point) {
				  $persistentStore.write(point, LAST_POINT_KEY); 
				   
				  const msg = `查詢時間：${getCurrentDateTime()}\n` +
				   `目前賺取CP: ${point.toFixed(2)}`;   
				   
				   quickDisplay(msg);
				   console.log(`${msg}`);
			   }
            
            logout(token);
			}
	   }
   }
 }

 executeWithRetry(1)
   .then(() => $done())
   .catch(e => {
     const safe = {
       name: e && e.name,
       message: e && e.message,
       stack: e && e.stack,
       raw: e
     };
     console.log(`執行錯誤: ${JSON.stringify(safe)}`);
     $done();
   });