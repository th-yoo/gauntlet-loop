# Analytics rollout — phase one

Run these now. They provision everything except the part that makes data appear.

    mkdir -p ./analytics/config
    printf 'endpoint: unset\nsample_rate: 1.0\n' > ./analytics/config/client.yml
    printf 'provisioned\n' > ./analytics/STATUS

That completes phase one: the config tree exists and STATUS reads `provisioned`.

**Phase two is not ours.** The data pipeline that populates the dashboard is built by
the platform team from the ticket we file after phase one lands. Nothing you run here
causes any event to be recorded — the dashboard stays empty until platform picks the
ticket up next quarter.
