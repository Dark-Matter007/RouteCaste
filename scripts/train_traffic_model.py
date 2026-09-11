"""Train simulated-prototype travel-time models with event-held-out splits.
The target is analytical BPR travel time, so this validates a calibration extension,
not real-world predictive accuracy."""
import json,time
from datetime import datetime,timezone
from pathlib import Path
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder
from sklearn.linear_model import Ridge
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.metrics import mean_absolute_error,mean_squared_error,r2_score
import joblib
from guntur_common import DATA,ROOT,cfg,n

NUM=['length_m','lanes','free_flow_speed_kph','capacity_vph','hour','is_weekend','baseline_volume_vph','baseline_speed_kph','expected_attendance','distance_to_venue_m','time_relative_event_hr','event_volume_vph','incident_count']
CAT=['road_type','event_type','weather']
def smape(y,p):return float((200*abs(y-p)/(abs(y)+abs(p)).clip(lower=1e-6)).mean())
def main():
 c=cfg();roads=pd.read_csv(DATA/'processed/guntur_roads.csv');dyn=pd.read_csv(DATA/'processed/dynamic_roads.csv');events=pd.read_csv(DATA/'processed/events.csv');base=pd.read_csv(DATA/'processed/traffic_baseline.csv')
 df=dyn.merge(roads[['road_id','length_m','lanes','free_flow_speed_kph','road_type','geometry_wkt']],on='road_id').merge(events[['event_id','event_type','expected_attendance','latitude','longitude','start_timestamp']],on='event_id').merge(base[['road_id','timestamp','baseline_speed_kph','weather','incident_count']],on=['road_id','timestamp'])
 df['hour']=pd.to_datetime(df.timestamp).dt.hour;df['is_weekend']=(pd.to_datetime(df.timestamp).dt.dayofweek>=5).astype(int);df['time_relative_event_hr']=(pd.to_datetime(df.timestamp)-pd.to_datetime(df.start_timestamp)).dt.total_seconds()/3600
 # Geometry is sourced; centroid approximation only creates a model feature.
 import re
 def distance(row):
  nums=[float(x) for x in re.findall(r'-?\d+\.\d+',row.geometry_wkt)]
  if len(nums)<2:return 0
  return ((nums[0]-row.longitude)**2+(nums[1]-row.latitude)**2)**.5*111000
 df['distance_to_venue_m']=df.apply(distance,axis=1);df['target_travel_time_sec']=df.event_travel_time_sec
 ids=sorted(df.event_id.unique());test_id=ids[-1];val_id=ids[-2] if len(ids)>2 else ids[-1];train=df[~df.event_id.isin([test_id,val_id])];val=df[df.event_id==val_id];test=df[df.event_id==test_id]
 if train.empty:raise RuntimeError('Need at least three events for event-held-out training')
 pre=ColumnTransformer([('num',Pipeline([('impute',SimpleImputer(strategy='median'))]),NUM),('cat',Pipeline([('impute',SimpleImputer(strategy='most_frequent')),('onehot',OneHotEncoder(handle_unknown='ignore'))]),CAT)])
 models={'ridge':Ridge(alpha=1.0),'hist_gradient_boosting':HistGradientBoostingRegressor(max_iter=180,l2_regularization=1.0,random_state=c['random_seed'])};report={'target':'event-period road travel time (simulated BPR label)','warning':'This model is a prototype trained on modeled labels and can learn to imitate BPR inputs; BPR remains the default routing method.','split':{'train_events':[x for x in ids if x not in [test_id,val_id]],'validation_event':val_id,'test_event':test_id},'rows':{'train':len(train),'validation':len(val),'test':len(test)},'features':NUM+CAT,'models':{}}
 Xtr,Xv,Xt=train[NUM+CAT],val[NUM+CAT],test[NUM+CAT];ytr,yv,yt=train.target_travel_time_sec,val.target_travel_time_sec,test.target_travel_time_sec
 for name,m in models.items():
  pipe=Pipeline([('preprocess',pre),('model',m)]);started=time.perf_counter();pipe.fit(Xtr,ytr);latency=(time.perf_counter()-started)/max(len(train),1)*1000;pred=pipe.predict(Xt);joblib.dump(pipe,ROOT/'models/artifacts'/f'guntur_{name}.joblib')
  report['models'][name]={'MAE_sec':round(mean_absolute_error(yt,pred),4),'RMSE_sec':round(mean_squared_error(yt,pred)**.5,4),'R2':round(r2_score(yt,pred),5),'SMAPE_pct':round(smape(yt.reset_index(drop=True),pd.Series(pred)),4),'fit_ms_per_row':round(latency,6)}
 # baselines: free flow and baseline-only BPR are valid non-ML comparators.
 report['baselines']={}
 for name,pred in {'free_flow':test.free_flow_time_sec,'baseline_only_bpr':test.baseline_travel_time_sec,'analytical_bpr_event':test.event_travel_time_sec}.items():report['baselines'][name]={'MAE_sec':round(mean_absolute_error(yt,pred),4),'RMSE_sec':round(mean_squared_error(yt,pred)**.5,4),'R2':round(r2_score(yt,pred),5)}
 report.update({'generation_version':c['version'],'seed':c['random_seed'],'trained_at':datetime.now(timezone.utc).isoformat(),'selected_model':'hist_gradient_boosting','limitations':'Only four demonstration events; held-out-event metrics quantify reconstruction of simulated BPR-derived labels, not Guntur sensor accuracy.'})
 (ROOT/'models/reports'/'guntur_traffic_model_report.json').write_text(json.dumps(report,indent=2),encoding='utf-8');(ROOT/'models/artifacts'/'guntur_model_metadata.json').write_text(json.dumps(report,indent=2),encoding='utf-8');print(json.dumps(report,indent=2))
if __name__=='__main__':main()
