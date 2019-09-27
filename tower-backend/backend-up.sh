# Launch backend server
java \
   -XX:+UseContainerSupport \
  -Dcom.sun.management.jmxremote \
  -noverify \
  -Dmicronaut.config.files=tower.yml \
  ${JAVA_OPTS} \
  -jar /tower/tower-backend.jar
