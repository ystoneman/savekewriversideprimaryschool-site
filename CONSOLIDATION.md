# One maintained website

The complete source and reviewed publishing pipeline live in `ystoneman/savekewriversideprimaryschool-site`. A change goes through one pull request with privacy/data validation and all browser projects. Main deploys the public allowlist directly to https://savekewriversideprimaryschool.org/.

The original `ystoneman/kew-riverside-website` and previous `ystoneman/savekewriverside-site` repositories contain only compatibility deployment workflows and configuration. They retain their existing Pages assignments and TLS. Their workflows fetch an exact canonical source commit after verifying its successful validation, browser-test and deployment jobs. They build the same small compatibility bundle from canonical source. Full legacy pages, submission forms and analytics are retired.

The canonical pipeline dispatches a compatibility deployment only when its generated file digest changes. A GitHub App installed only on the two legacy repositories grants Actions read/write, with no Contents write permission. Its App ID is `LEGACY_DEPLOY_APP_ID` and private key is `LEGACY_DEPLOY_APP_PRIVATE_KEY`, stored as canonical Actions secrets. No credential enters source, artifacts or logs. A missing credential or failed dispatch blocks release completion; rerun the compatibility job after fixing the failure.

The complete canonical pipeline and each compatibility pipeline serialize deployments. Compatibility jobs reject superseded canonical deployments both before generation and immediately before publishing. They also verify the final served bytes. Old PDFs, CSVs, JSON, calendars and shared images remain real files using the explicit compatibility asset list. Personal-data removal is complete only after every retained board has been checked on all three origins.

Legacy Letters/Sent routes keep browser-origin recovery with Copy, Clear and Continue. Drafts retain seven-day expiry, pending records retain thirty-minute expiry, and differing copies stay separate. Nothing is transferred or submitted automatically. No-JavaScript visitors get corresponding current-page links and known protected section links; browser storage recovery requires JavaScript.

Rollback uses the current approved source and current boards. Never restore an obsolete promotion or withdrawn public material. Historical source branches and unfinished local work remain preserved until reconciled.
